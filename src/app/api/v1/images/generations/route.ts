import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { generateImage, type ImageGenerationBody } from "@/lib/multimodal-gateway";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    // 1. Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return openaiError("Missing or invalid Authorization header", "invalid_request_error", 401);
    }
    const token = authHeader.slice(7).trim();
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true },
    });
    if (!apiKey || !apiKey.isActive) {
      return openaiError("Invalid or inactive API Key", "invalid_request_error", 401);
    }
    const user = apiKey.user;
    if (user.isBanned) {
      return openaiError("Your account has been suspended", "access_denied", 403);
    }

    // 2. Parse body
    const body = (await req.json()) as ImageGenerationBody;
    const requestedModel = body?.model;
    if (!requestedModel) {
      return openaiError("Missing 'model' field", "invalid_request_error", 400);
    }
    if (!body?.prompt) {
      return openaiError("Missing 'prompt' field", "invalid_request_error", 400);
    }

    // 3. Resolve model -> provider
    const resolved = await resolveModel(prisma, requestedModel);
    if (!resolved) {
      return openaiError(
        `Model '${requestedModel}' is not available. Visit the dashboard /dashboard/models to see available models.`,
        "model_not_found",
        404
      );
    }
    const { provider, model } = resolved;

    // Check balance: image generation requires at least the flat task fee
    const discountRate = apiKey.user.discountRate ?? 1.0;
    const finalFee = model.inputPricePer1k * discountRate;
    if (user.balance < finalFee) {
      return openaiError("Insufficient balance for this generation", "insufficient_balance", 402);
    }

    if (!provider.apiKeyCipher) {
      return openaiError(
        `Provider '${provider.name}' has no API key configured`,
        "api_key_missing",
        503
      );
    }

    // 4. Forward
    const upstreamKey = decryptSecret(provider.apiKeyCipher);
    const result = await generateImage({
      provider,
      apiKey: upstreamKey,
      upstreamModelId: model.modelId,
      body,
    });

    // 5. Bill & log (image generation is billed flat-rate per request, representing 1000 tokens)
    await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, 1000, finalFee);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Image Gateway error:", err);
    return openaiError("Internal Server Error: " + err.message, "internal_server_error", 500);
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

function openaiError(message: string, type = "invalid_request_error", status = 400) {
  return NextResponse.json({
    error: {
      message,
      type,
      param: null,
      code: null
    }
  }, { status });
}
