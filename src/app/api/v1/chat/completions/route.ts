import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { forwardChatCompletion, type OpenAIChatBody } from "@/lib/llm-gateway";

export const dynamic = "force-dynamic";

/**
 * OpenAI-compatible /v1/chat/completions gateway.
 * Routes incoming requests to the correct upstream provider based on the
 * admin-configured Provider/ProviderModel tables.
 */
export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    // 1. Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true },
    });
    if (!apiKey || !apiKey.isActive) {
      return NextResponse.json({ error: "Invalid or inactive API Key" }, { status: 401 });
    }
    const user = apiKey.user;
    if (user.isBanned) {
      return NextResponse.json({ error: "Your account has been suspended" }, { status: 403 });
    }
    if (user.balance < 0.0001) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 402 });
    }

    // 2. Parse body
    const body = (await req.json()) as OpenAIChatBody;
    const requestedModel = body?.model;
    if (!requestedModel) {
      return NextResponse.json({ error: "Missing 'model' field" }, { status: 400 });
    }

    // 3. Resolve model -> provider
    // Support two addressing schemes:
    //   - "provider-slug/model-id"   (explicit, Cherry Studio / OpenRouter style)
    //   - "model-id"                 (first enabled match)
    let resolved = null as Awaited<ReturnType<typeof resolveModel>>;
    resolved = await resolveModel(prisma, requestedModel);
    if (!resolved) {
      return NextResponse.json(
        {
          error: `Model '${requestedModel}' is not available. Visit the dashboard /dashboard/models to see available models.`,
        },
        { status: 404 }
      );
    }
    const { provider, model } = resolved;

    if (!provider.apiKeyCipher) {
      return NextResponse.json(
        { error: `Provider '${provider.name}' has no API key configured` },
        { status: 503 }
      );
    }

    // 4. Forward
    const upstreamKey = decryptSecret(provider.apiKeyCipher);
    const { streaming, response, usage } = await forwardChatCompletion({
      provider,
      apiKey: upstreamKey,
      upstreamModelId: model.modelId,
      body,
    });

    // 5. Bill & log
    if (streaming) {
      // For MVP we do not tap into stream bodies to count tokens;
      // we instead charge a minimum per-request fee using max_tokens heuristic,
      // and let future iterations parse the stream.
      const promptEstimate = estimatePromptTokens(body);
      const outputEstimate = Math.min(body.max_tokens ?? 512, 1024);
      const cost = computeCost(promptEstimate, outputEstimate, model);
      void chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, promptEstimate + outputEstimate, cost);
      return response;
    }

    if (usage) {
      const cost = computeCost(usage.input, usage.output, model);
      await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, usage.total, cost);
    } else {
      // Just touch lastUsedAt
      await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    }

    return response;
  } catch (err: any) {
    console.error("Gateway error:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}

// ----- helpers -----

async function resolveModel(prisma: ReturnType<typeof getPrisma>, requested: string) {
  // 1. Try "slug/modelId" form
  const slashIdx = requested.indexOf("/");
  if (slashIdx > 0) {
    const slug = requested.slice(0, slashIdx);
    const modelId = requested.slice(slashIdx + 1);
    const prov = await prisma.provider.findUnique({ where: { slug } });
    if (prov && prov.isEnabled) {
      const m = await prisma.providerModel.findFirst({
        where: { providerId: prov.id, modelId, isEnabled: true },
      });
      if (m) return { provider: prov, model: m };
    }
  }
  // 2. Fallback: find first enabled model globally
  const m = await prisma.providerModel.findFirst({
    where: { modelId: requested, isEnabled: true, provider: { isEnabled: true } },
    include: { provider: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (m) return { provider: m.provider, model: m };
  return null;
}

function computeCost(
  promptTokens: number,
  completionTokens: number,
  model: { inputPricePer1k: number; outputPricePer1k: number }
): number {
  return (
    (promptTokens / 1000) * model.inputPricePer1k +
    (completionTokens / 1000) * model.outputPricePer1k
  );
}

function estimatePromptTokens(body: OpenAIChatBody): number {
  // Very rough: ~1 token per 4 chars of text
  let chars = 0;
  for (const m of body.messages || []) {
    if (typeof m.content === "string") chars += m.content.length;
    else if (Array.isArray(m.content)) {
      for (const p of m.content) if (p && typeof (p as any).text === "string") chars += (p as any).text.length;
    }
  }
  return Math.max(1, Math.ceil(chars / 4));
}

async function chargeUser(
  prisma: ReturnType<typeof getPrisma>,
  apiKeyId: string,
  userId: string,
  providerSlug: string,
  modelId: string,
  totalTokens: number,
  cost: number
) {
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: cost } },
      }),
      prisma.usageLog.create({
        data: {
          userId,
          model: modelId,
          provider: providerSlug,
          tokens: totalTokens,
          cost,
        },
      }),
      prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      }),
    ]);
  } catch (e) {
    console.error("chargeUser failed:", e);
  }
}
