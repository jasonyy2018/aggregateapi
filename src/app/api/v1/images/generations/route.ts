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

    // 2. Parse body
    const body = (await req.json()) as ImageGenerationBody;
    const requestedModel = body?.model;
    if (!requestedModel) {
      return NextResponse.json({ error: "Missing 'model' field" }, { status: 400 });
    }
    if (!body?.prompt) {
      return NextResponse.json({ error: "Missing 'prompt' field" }, { status: 400 });
    }

    // 3. Resolve model -> provider
    const resolved = await resolveModel(prisma, requestedModel);
    if (!resolved) {
      return NextResponse.json(
        {
          error: `Model '${requestedModel}' is not available. Visit the dashboard /dashboard/models to see available models.`,
        },
        { status: 404 }
      );
    }
    const { provider, model } = resolved;

    // Check balance: image generation requires at least the flat task fee
    const flatFee = model.inputPricePer1k;
    if (user.balance < flatFee) {
      return NextResponse.json({ error: "Insufficient balance for this generation" }, { status: 402 });
    }

    if (!provider.apiKeyCipher) {
      return NextResponse.json(
        { error: `Provider '${provider.name}' has no API key configured` },
        { status: 503 }
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
    await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, 1000, flatFee);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Image Gateway error:", err);
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
