import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { forwardChatCompletion, type OpenAIChatBody } from "@/lib/llm-gateway";
import { generateImage, createVideoMusicTask, queryTaskStatus } from "@/lib/multimodal-gateway";

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
    // ADMIN users bypass the balance check — they can always test the platform.
    // Regular users must have a positive balance to proceed.
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && user.balance < 0.0001) {
      return openaiError("Insufficient balance", "insufficient_balance", 402);
    }

    // 2. Parse body
    const body = (await req.json()) as OpenAIChatBody;
    
    // Sanitize any buggy "[undefined]" string inputs sent by clients (e.g. Cherry Studio)
    if (body && typeof body === "object") {
      for (const key in body) {
        if ((body as any)[key] === "[undefined]") {
          delete (body as any)[key];
        }
      }
    }

    const requestedModel = body?.model;
    if (!requestedModel) {
      return openaiError("Missing 'model' field", "invalid_request_error", 400);
    }

    // 3. Resolve model -> provider
    // Support two addressing schemes:
    //   - "provider-slug/model-id"   (explicit, Cherry Studio / OpenRouter style)
    //   - "model-id"                 (first enabled match)
    let resolved = null as Awaited<ReturnType<typeof resolveModel>>;
    resolved = await resolveModel(prisma, requestedModel);
    if (!resolved) {
      return openaiError(
        `Model '${requestedModel}' is not available. Visit the dashboard /dashboard/models to see available models.`,
        "model_not_found",
        404
      );
    }
    const { provider, model } = resolved;

    if (!provider.apiKeyCipher) {
      return openaiError(
        `Provider '${provider.name}' has no API key configured`,
        "api_key_missing",
        503
      );
    }

    const upstreamKey = decryptSecret(provider.apiKeyCipher);

    // 3.5 Intercept Image/Video/Music models for unified API completions!
    const isImage = model.capabilities.includes("image");
    const isVideo = model.capabilities.includes("video");
    const isMusic = model.capabilities.includes("music");

    if (isImage || isVideo || isMusic) {
      // Extract prompt text
      const lastUserMsg = body.messages?.filter((m: any) => m.role === "user").pop();
      const prompt = lastUserMsg?.content || "generate";
      let promptText = "";
      if (typeof prompt === "string") {
        promptText = prompt;
      } else if (Array.isArray(prompt)) {
        const textItem = prompt.find((item: any) => item.type === "text");
        promptText = textItem?.text || "";
      }

      const discountRate = apiKey.user.discountRate ?? 1.0;
      const finalFee = model.inputPricePer1k * discountRate;

      // Check balance (ADMIN users bypass this check)
      if (!isAdmin && user.balance < finalFee) {
        return openaiError("Insufficient balance for this generation", "insufficient_balance", 402);
      }

      if (isImage) {
        const result = await generateImage({
          provider,
          apiKey: upstreamKey,
          upstreamModelId: model.modelId,
          body: {
            prompt: promptText,
            model: model.modelId,
            size: "1024x1024",
          },
        });

        // Bill & log (image generation is billed flat-rate per request, representing 1000 tokens)
        await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, 1000, finalFee);

        const imageUrl = result.data?.[0]?.url || "";
        const content = `Here is your generated image:\n\n![Generated Image](${imageUrl})\n\n[Open Image in New Tab](${imageUrl})`;

        return NextResponse.json({
          id: "chatcmpl-" + Math.random().toString(36).substring(7),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: requestedModel,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
              },
              finish_reason: "stop",
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60,
          }
        });
      } else {
        // Video or Music Task Creation
        const taskId = await createVideoMusicTask({
          provider,
          apiKey: upstreamKey,
          upstreamModelId: model.modelId,
          body: {
            prompt: promptText,
            model: model.modelId,
          },
        });

        // Bill & log
        await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, 1000, finalFee);

        // Seamless synchronous polling loop for up to 35 seconds to return the generated URL directly in chat!
        let taskState = "generating";
        let resultUrls: string[] = [];
        let failMsg = "";

        const maxRetries = 18; // 18 * 2s = 36s
        for (let i = 0; i < maxRetries; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            const status = await queryTaskStatus({
              provider,
              apiKey: upstreamKey,
              taskId,
            });
            taskState = status.state;
            if (status.state === "success") {
              resultUrls = status.resultUrls;
              break;
            }
            if (status.state === "fail") {
              failMsg = status.failMsg || "Generation failed";
              break;
            }
          } catch (err: any) {
            console.error("Task Status polling failed inside chat completion:", err.message);
          }
        }

        let content = "";
        if (taskState === "success" && resultUrls.length > 0) {
          const url = resultUrls[0];
          const isVideoFormat = isVideo || url.endsWith(".mp4") || url.includes("video");
          if (isVideoFormat) {
            content = `Here is your generated video:\n\n![Generated Video](${url})\n\n[Download Video](${url})`;
          } else {
            content = `Here is your generated audio/music:\n\n[Play / Download Audio](${url})`;
          }
        } else if (taskState === "fail") {
          content = `Failed to generate: ${failMsg || "Upstream generation failed"}`;
        } else {
          // Timeout: return Task ID so they can check it or watch progress in dashboard
          content = `Your generation task is still processing. You can check its progress in your dashboard or poll this status:\n\n* **Task ID**: \`${taskId}\`\n* **Provider**: \`${provider.slug}\`\n* **Model**: \`${model.modelId}\`\n\n[View Task History](/dashboard/billing)`;
        }

        return NextResponse.json({
          id: "chatcmpl-" + Math.random().toString(36).substring(7),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: requestedModel,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
              },
              finish_reason: "stop",
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60,
          }
        });
      }
    }

    // 4. Forward
    const { streaming, response, usage } = await forwardChatCompletion({
      provider,
      apiKey: upstreamKey,
      upstreamModelId: model.modelId,
      body,
    });

    // 5. Bill & log
    const discountRate = apiKey.user.discountRate ?? 1.0;

    if (streaming) {
      // For MVP we do not tap into stream bodies to count tokens;
      // we instead charge a minimum per-request fee using max_tokens heuristic,
      // and let future iterations parse the stream.
      if (!isAdmin) {
        const promptEstimate = estimatePromptTokens(body);
        const outputEstimate = Math.min(body.max_tokens ?? 512, 1024);
        const cost = computeCost(promptEstimate, outputEstimate, model) * discountRate;
        void chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, promptEstimate + outputEstimate, cost);
      } else {
        void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
      }
      return response;
    }

    if (usage && !isAdmin) {
      const cost = computeCost(usage.input, usage.output, model) * discountRate;
      await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, usage.total, cost);
    } else {
      // Admin users or no usage data — just touch lastUsedAt
      await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    }

    return response;
  } catch (err: any) {
    console.error("Gateway error:", err);
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
