import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { mapImageModel, mapVideoModel } from "@/lib/multimodal-gateway";

export const dynamic = "force-dynamic";

/**
 * Gateway route for /api/v1/jobs/createTask (Kie.ai-compatible structure).
 * Routes task requests to the correct upstream provider model based on resolution.
 */
export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    // 1. Auth: Bearer Token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid Authorization header", 401);
    }
    const token = authHeader.slice(7).trim();
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true },
    });
    if (!apiKey || !apiKey.isActive) {
      return errorResponse("Invalid or inactive API Key", 401);
    }

    const user = apiKey.user;
    if (user.isBanned) {
      return errorResponse("Your account has been suspended", 403);
    }

    // 2. Parse body
    const body = await req.json();
    const requestedModel = body?.model;
    if (!requestedModel) {
      return errorResponse("Missing 'model' field", 400);
    }
    if (!body?.input?.prompt) {
      return errorResponse("Missing 'input.prompt' field", 400);
    }

    // 3. Resolve model to database record based on resolution
    let dbModelId = requestedModel;
    if (requestedModel === "nano-banana-2") {
      const res = String(body.input?.resolution || "1K").toUpperCase();
      if (res === "4K") {
        dbModelId = "google-nano-banana-2-4k";
      } else if (res === "2K") {
        dbModelId = "google-nano-banana-2-2k";
      } else {
        dbModelId = "google-nano-banana-2-1k";
      }
    } else if (requestedModel === "grok-imagine/image-to-video") {
      const res = String(body.input?.resolution || "480p").toLowerCase();
      if (res === "720p") {
        dbModelId = "grok-imagine-image-to-video-720p";
      } else {
        dbModelId = "grok-imagine-image-to-video-480p";
      }
    } else if (requestedModel === "bytedance/seedance-2") {
      const res = String(body.input?.resolution || "720p").toLowerCase();
      const hasFirstFrame = body.input?.first_frame_url || body.input?.last_frame_url || body.input?.reference_image_urls?.length;
      if (res === "1080p") {
        dbModelId = hasFirstFrame ? "seedance-2.0-720p-with-video-input" : "seedance-2.0-720p-no-video-input";
      } else if (res === "720p") {
        dbModelId = hasFirstFrame ? "seedance-2.0-720p-with-video-input" : "seedance-2.0-720p-no-video-input";
      } else {
        dbModelId = hasFirstFrame ? "seedance-2.0-480p-with-video-input" : "seedance-2.0-480p-no-video-input";
      }
    }

    const resolved = await resolveModel(prisma, dbModelId);
    if (!resolved) {
      return errorResponse(`Model '${requestedModel}' with resolved ID '${dbModelId}' is not available.`, 404);
    }
    const { provider, model } = resolved;

    // Check user balance: require flat fee billing
    const discountRate = apiKey.user.discountRate ?? 1.0;
    const finalFee = model.inputPricePer1k * discountRate;
    if (user.balance < finalFee) {
      return errorResponse("Insufficient balance for this task", 402);
    }

    if (!provider.apiKeyCipher) {
      return errorResponse(`Provider '${provider.name}' has no API key configured`, 503);
    }

    const upstreamKey = decryptSecret(provider.apiKeyCipher);

    // 4. Forward payload to Kie.ai
    const cleanBase = provider.baseUrl.replace(/\/v1$/, "").replace(/\/+$/, "");
    const upstreamUrl = `${cleanBase}/api/v1/jobs/createTask`;

    // Determine the correct upstream model ID.
    // IMPORTANT: Use dbModelId (the resolved platform model ID, e.g. "google-nano-banana-2-1k")
    // as the base for mapping — NOT requestedModel (the raw client input, e.g. "nano-banana-2").
    // This ensures the mapping functions receive the canonical platform ID they expect.
    let upstreamModel = dbModelId;
    // Try image model mapping (covers flux, midjourney, nano-banana, etc.)
    const mappedImage = mapImageModel(dbModelId);
    if (mappedImage.upstreamModelId !== dbModelId) {
      upstreamModel = mappedImage.upstreamModelId;
    } else {
      // Try video model mapping (covers kling, runway, suno, etc.)
      const mappedVideo = mapVideoModel(dbModelId);
      if (mappedVideo.upstreamModelId !== dbModelId) {
        upstreamModel = mappedVideo.upstreamModelId;
      }
    }

    console.log(`[KIE Gateway] Client model "${requestedModel}" → DB model "${dbModelId}" → upstream "${upstreamModel}"`);

    const upstreamPayload = {
      model: upstreamModel,
      callBackUrl: body.callBackUrl,
      input: body.input,
    };

    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstreamKey}`,
        ...(provider.extraHeaders as Record<string, string> | null ?? {}),
      },
      body: JSON.stringify(upstreamPayload),
    });

    // Safely parse response — Kie.ai may return HTML on error (e.g. 404), not JSON
    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return errorResponse(
        `Kie.ai returned non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 300)}`,
        res.status || 502
      );
    }

    if (!res.ok) {
      return errorResponse(`Upstream Task Creation Failed (HTTP ${res.status}): ${data?.msg || JSON.stringify(data)}`, res.status);
    }

    if (data?.code && data.code !== 0 && data.code !== 200) {
      return errorResponse(`Kie.ai Task Creation Failed: ${data.msg || JSON.stringify(data)}`, 400);
    }

    const taskId = data?.data?.taskId;
    if (!taskId) {
      return errorResponse(`Kie.ai did not return a taskId. Upstream response: ${JSON.stringify(data)}`, 500);
    }

    // 5. Bill & log flat-rate charge (represents 1000 tokens in database pricing)
    await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, 1000, finalFee);

    return NextResponse.json({
      code: 200,
      msg: "success",
      data: {
        taskId,
      },
    });

  } catch (err: any) {
    console.error("Async Task Creation error:", err);
    return errorResponse("Internal Server Error: " + err.message, 500);
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

function errorResponse(message: string, code = 400) {
  return NextResponse.json({
    code,
    msg: message,
    data: null,
  }, { status: code });
}
