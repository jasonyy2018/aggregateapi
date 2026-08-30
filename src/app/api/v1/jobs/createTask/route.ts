import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getRegistryEntry } from "@/lib/model-registry";
import { chargeUserWithSubscription } from "@/lib/billing";
import { resolveModel, kieError, chargeUser, getCleanDomainBase } from "@/lib/shared";
import { createVideoMusicTask } from "@/lib/multimodal-gateway";

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
      return kieError("Missing or invalid Authorization header", 401);
    }
    const token = authHeader.slice(7).trim();
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true },
    });
    if (!apiKey || !apiKey.isActive) {
      return kieError("Invalid or inactive API Key", 401);
    }

    const user = apiKey.user;
    if (user.isBanned) {
      return kieError("Your account has been suspended", 403);
    }

    // 2. Parse body
    const body = await req.json();
    const requestedModel = body?.model;
    if (!requestedModel) {
      return kieError("Missing 'model' field", 400);
    }
    if (!body?.input?.prompt) {
      return kieError("Missing 'input.prompt' field", 400);
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
    } else if (requestedModel === "nano-banana-pro") {
      const res = String(body.input?.resolution || "1K").toUpperCase();
      if (res === "4K") {
        dbModelId = "google-nano-banana-pro-4k";
      } else {
        dbModelId = "google-nano-banana-pro-1-2k";
      }
    } else if (requestedModel === "gpt-image-1.5") {
      const quality = String(body.input?.quality || "medium").toLowerCase();
      const hasImageInput = Boolean(body.input?.image_url || body.input?.image_urls?.length);
      if (hasImageInput) {
        dbModelId = quality === "high" ? "gpt-image-1.5-image-to-image-high" : "gpt-image-1.5-image-to-image-medium";
      } else {
        dbModelId = quality === "high" ? "gpt-image-1.5-text-to-image-high" : "gpt-image-1.5-text-to-image-medium";
      }
    } else if (requestedModel === "gpt-image-2") {
      const res = String(body.input?.resolution || "1K").toUpperCase();
      const hasImageInput = Boolean(body.input?.image_url || body.input?.image_urls?.length);
      if (res === "4K") {
        dbModelId = hasImageInput ? "gpt-image-2-image-to-image-4k" : "gpt-image-2-text-to-image-4k";
      } else if (res === "2K") {
        dbModelId = hasImageInput ? "gpt-image-2-image-to-image-2k" : "gpt-image-2-text-to-image-2k";
      } else {
        dbModelId = hasImageInput ? "gpt-image-2-image-to-image-1k" : "gpt-image-2-text-to-image-1k";
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
      return kieError(`Model '${requestedModel}' with resolved ID '${dbModelId}' is not available.`, 404);
    }
    const { provider, model } = resolved;

    if (!provider.apiKeyCipher) {
      return kieError("Model provider missing API key configuration", 503);
    }

    const upstreamKey = decryptSecret(provider.apiKeyCipher);

    // 4. Forward payload to upstream
    const cleanBase = getCleanDomainBase(provider.baseUrl);
    const upstreamUrl = `${cleanBase}/api/v1/jobs/createTask`;

    // Determine the upstream model ID and any input patch via the registry.
    const registryEntry = getRegistryEntry(dbModelId);
    const upstreamModel = registryEntry?.upstreamModelId ?? dbModelId;
    const inputPatch = registryEntry?.inputPatch ?? {};

    // Merge inputPatch into body.input (client-provided values take priority over patch defaults)
    const mergedInput = { ...inputPatch, ...body.input };

    if (mergedInput.duration !== undefined && mergedInput.duration !== null) {
      if (typeof mergedInput.duration === "string") {
        const num = parseFloat(mergedInput.duration);
        if (!isNaN(num)) {
          mergedInput.duration = num;
        }
      }
    }

    // Calculate final fee using duration multiplier for video models
    let durationMultiplier = 1.0;
    if (model.capabilities.includes("video")) {
      let d = 5.0; // default default
      const { parseGeminiOmniVideoId } = await import("@/lib/pricing");
      const extracted = parseGeminiOmniVideoId(dbModelId);
      if (extracted.duration !== undefined) {
        d = extracted.duration;
      }
      const inputDuration = mergedInput.duration;
      if (inputDuration !== undefined && inputDuration !== null) {
        const parsed = typeof inputDuration === "number" ? inputDuration : parseFloat(inputDuration);
        if (!isNaN(parsed) && parsed > 0) {
          d = parsed;
        }
      }
      durationMultiplier = d;
    }

    // Check user balance: require flat fee billing
    const discountRate = apiKey.user.discountRate ?? 1.0;
    const finalFee = Math.max(model.inputPricePer1k * discountRate, model.costInputPer1k) * durationMultiplier;
    if (user.balance < finalFee) {
      return kieError("Insufficient balance for this task", 402);
    }

    // 4. Forward payload to upstream via unified multimodal gateway
    const taskId = await createVideoMusicTask({
      provider,
      apiKey: upstreamKey,
      upstreamModelId: model.modelId,
      body: {
        model: requestedModel,
        prompt: body?.input?.prompt || "",
        aspect_ratio: mergedInput.aspect_ratio || mergedInput.aspectRatio,
        duration: mergedInput.duration,
        image_url: mergedInput.image_url || mergedInput.imageUrl,
        image_urls: mergedInput.image_urls || mergedInput.imageUrls,
        first_frame: mergedInput.first_frame || mergedInput.first_frame_url,
        last_frame: mergedInput.last_frame || mergedInput.last_frame_url,
        mode: mergedInput.mode,
        resolution: mergedInput.resolution,
        style: mergedInput.style,
        lyrics: mergedInput.lyrics,
        instrumental: mergedInput.instrumental,
      },
    });

    // 5. Bill & log flat-rate charge (represents 1000 tokens in database pricing)
    await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, Math.round(1000 * durationMultiplier), finalFee);

    // Save task to TaskLog in database for 7-day history persistence
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        taskId,
        model: requestedModel,
        provider: provider.slug,
        prompt: body?.input?.prompt || "",
        status: "generating",
      },
    }).catch((e) => console.error("Failed to save TaskLog:", e));

    return NextResponse.json({
      code: 200,
      msg: "success",
      data: {
        taskId,
      },
    });

  } catch (err: any) {
    console.error("Async Task Creation error:", err.message);
    if (err.message === "insufficient_balance") {
      return kieError("Insufficient balance. Please top up your account.", 402);
    }
    return kieError("Internal Server Error: " + err.message, 500);
  }
}