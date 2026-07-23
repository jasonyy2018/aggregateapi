import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { forwardChatCompletion, anthropicStreamToOpenAI, type OpenAIChatBody } from "@/lib/llm-gateway";
import { generateImage, createVideoMusicTask, queryTaskStatus } from "@/lib/multimodal-gateway";
import { getRegistryEntry } from "@/lib/model-registry";
import { chargeUserWithSubscription } from "@/lib/billing";
import { resolveModel, openaiError, chargeUser, computeCost, computeCostFloor, estimatePromptTokens } from "@/lib/shared";

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

    // 3.5 Determine routing: registry first, fall back to DB capabilities
    const registryEntry = getRegistryEntry(model.modelId);
    const protocol = registryEntry?.protocol;

    // Registry-aware routing flags
    const isImage = protocol === "kie-task-image" || (!protocol && model.capabilities.includes("image"));
    const isVideo = protocol === "kie-task-video" || (!protocol && model.capabilities.includes("video"));
    const isMusic = protocol === "kie-task-music" || (!protocol && model.capabilities.includes("music"));
    const isAnthropicChat = protocol === "anthropic-chat" || (!protocol && model.modelId.toLowerCase().startsWith("claude-"));

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

      // Calculate final fee using duration multiplier for video models
      let durationMultiplier = 1.0;
      if (isVideo) {
        let d = 5.0; // default default
        const { parseGeminiOmniVideoId } = await import("@/lib/pricing");
        const extracted = parseGeminiOmniVideoId(model.modelId);
        if (extracted.duration !== undefined) {
          d = extracted.duration;
        }
        durationMultiplier = d;
      }

      const discountRate = apiKey.user.discountRate ?? 1.0;
      const finalFee = Math.max(model.inputPricePer1k * discountRate, model.costInputPer1k) * durationMultiplier;

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
        await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, Math.round(1000 * durationMultiplier), finalFee);

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

    // 3.6 Intercept Claude models — route through /claude/v1/messages (Anthropic format)
    // KIE exposes Claude at a dedicated endpoint; calling /v1/chat/completions with claude-* returns 404.
    // We transparently convert the OpenAI request to Anthropic format and back, so any client
    // (e.g. Cherry Studio in OpenAI mode) can use Claude models without extra configuration.
    if (isAnthropicChat) {
      const cleanBase = provider.baseUrl.replace(/\/v1$/, "").replace(/\/+$/, "");
      const upstreamUrl = `${cleanBase}/claude/v1/messages`;

      // Convert OpenAI messages → Anthropic format
      let system: string | undefined;
      const anthropicMessages: any[] = [];
      for (const m of (body.messages || [])) {
        if ((m as any).role === "system") {
          const txt = typeof (m as any).content === "string" ? (m as any).content : "";
          system = system ? `${system}\n\n${txt}` : txt;
        } else {
          const role = (m as any).role === "assistant" ? "assistant" : "user";
          const raw = (m as any).content;
          const content = typeof raw === "string"
            ? [{ type: "text", text: raw }]
            : Array.isArray(raw)
              ? raw.map((c: any) => c.type === "text" ? { type: "text", text: c.text ?? "" } : c)
              : [{ type: "text", text: String(raw ?? "") }];
          anthropicMessages.push({ role, content });
        }
      }

      const anthropicPayload: any = {
        model: model.modelId,
        messages: anthropicMessages,
        max_tokens: body.max_tokens ?? 4096,
        stream: !!body.stream,
      };
      if (system) anthropicPayload.system = system;
      if (body.temperature !== undefined) anthropicPayload.temperature = body.temperature;
      if ((body as any).top_p !== undefined) anthropicPayload.top_p = (body as any).top_p;

      const claudeHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${upstreamKey}`,
        "x-api-key": upstreamKey,
        "anthropic-version": "2023-06-01",
        ...(provider.extraHeaders as Record<string, string> | null ?? {}),
      };

      // Retry up to 2 extra times for transient KIE errors (422 / 5xx).
      // KIE occasionally returns {"code":422,"msg":"The page does not exist"} during
      // brief service hiccups; a short backoff resolves it without impacting the user.
      let claudeRes: Response | null = null;
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          // 1.5s → 3s backoff
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          console.warn(`[Claude Gateway] Retry attempt ${attempt} for model ${model.modelId} after transient error`);
        }
        claudeRes = await fetch(upstreamUrl, {
          method: "POST",
          headers: claudeHeaders,
          body: JSON.stringify(anthropicPayload),
        });
        // Only retry on KIE transient errors (422 or 5xx); break on success or 4xx auth errors
        if (claudeRes.ok) break;
        const retryableStatus = claudeRes.status === 422 || claudeRes.status >= 500;
        if (!retryableStatus) break;
        console.warn(`[Claude Gateway] Attempt ${attempt + 1} failed with status ${claudeRes.status}`);
      }

      if (!claudeRes!.ok) {
        const errText = await claudeRes!.text();
        console.error(`[Claude Gateway] Upstream error after ${maxAttempts} attempts:`, errText.slice(0, 500));
        let msg = `Claude API Error (HTTP ${claudeRes!.status})`;
        try {
          const e = JSON.parse(errText);
          msg = e?.error?.message || e?.msg || e?.message || msg;
        } catch {}
        return openaiError(msg, "upstream_error", claudeRes!.status || 502);
      }

      const discountRateClaude = apiKey.user.discountRate ?? 1.0;

      // ── Streaming ──
      if (body.stream) {
        if (!claudeRes!.body) return openaiError("Empty upstream body", "upstream_error", 502);
        const converted = anthropicStreamToOpenAI(claudeRes!.body, model.modelId);
        if (!isAdmin) {
          const est = estimatePromptTokens(body);
          const outEst = body.max_tokens !== undefined ? Math.min(body.max_tokens, 4096) : 2048;
          const cost = Math.max(
            computeCost(est, outEst, model) * discountRateClaude,
            computeCostFloor(est, outEst, model)
          );
          await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, est + outEst, cost);
        } else {
          await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
        }
        return new Response(converted, {
          status: 200,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
        });
      }

      // ── Non-streaming ──
      const rawClaudeText = await claudeRes!.text();
      console.log("[Claude Non-Stream] raw response:", rawClaudeText.slice(0, 500));
      let claudeData: any;
      try { claudeData = JSON.parse(rawClaudeText); } catch {
        return openaiError(`Claude returned non-JSON: ${rawClaudeText.slice(0, 200)}`, "upstream_error", 502);
      }
      // KIE may return content as a plain string field or as content array
      let textContent = "";
      if (Array.isArray(claudeData?.content)) {
        textContent = claudeData.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text ?? "")
          .join("");
      } else if (typeof claudeData?.content === "string") {
        textContent = claudeData.content;
      } else if (typeof claudeData?.completion === "string") {
        // Some Claude-compatible APIs return { completion: "..." }
        textContent = claudeData.completion;
      }
      console.log("[Claude Non-Stream] textContent:", textContent.slice(0, 200));
      const claudeUsage = {
        input: claudeData?.usage?.input_tokens ?? 0,
        output: claudeData?.usage?.output_tokens ?? 0,
        total: (claudeData?.usage?.input_tokens ?? 0) + (claudeData?.usage?.output_tokens ?? 0),
      };
      if (!isAdmin) {
        const cost = Math.max(
          computeCost(claudeUsage.input, claudeUsage.output, model) * discountRateClaude,
          computeCostFloor(claudeUsage.input, claudeUsage.output, model)
        );
        await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, claudeUsage.total, cost);
      } else {
        await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
      }
      return NextResponse.json({
        id: claudeData?.id || `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model.modelId,
        choices: [{ index: 0, message: { role: "assistant", content: textContent }, finish_reason: claudeData?.stop_reason || "stop" }],
        usage: { prompt_tokens: claudeUsage.input, completion_tokens: claudeUsage.output, total_tokens: claudeUsage.total },
      });
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
        const outputEstimate = body.max_tokens !== undefined ? Math.min(body.max_tokens, 4096) : 2048;
        const cost = Math.max(
          computeCost(promptEstimate, outputEstimate, model) * discountRate,
          computeCostFloor(promptEstimate, outputEstimate, model)
        );
        await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, promptEstimate + outputEstimate, cost);
      } else {
        await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
      }
      return response;
    }

    if (usage && !isAdmin) {
      const cost = Math.max(
        computeCost(usage.input, usage.output, model) * discountRate,
        computeCostFloor(usage.input, usage.output, model)
      );
      await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, usage.total, cost);
    } else {
      // Admin users or no usage data — just touch lastUsedAt
      await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    }

    return response;
  } catch (err: any) {
    console.error("Gateway error:", err.message);
    if (err.message === "insufficient_balance") {
      return openaiError("Insufficient balance. Please top up your account.", "insufficient_balance", 402);
    }
    return openaiError("Internal Server Error: " + err.message, "internal_server_error", 500);
  }
}
