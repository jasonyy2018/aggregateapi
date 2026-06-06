import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { chargeUserWithSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Native Anthropic /claude/v1/messages gateway.
 * Routes incoming requests to the correct upstream provider based on the
 * database configured models/providers.
 */
export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    // 1. Auth: Support both standard Bearer Auth and custom X-Api-Key headers
    let token = "";
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else {
      const apiKeyHeader = req.headers.get("x-api-key");
      if (apiKeyHeader) {
        token = apiKeyHeader.trim();
      }
    }

    if (!token) {
      return anthropicError("Missing or invalid API key", "authentication_error", 401);
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true },
    });
    if (!apiKey || !apiKey.isActive) {
      return anthropicError("Invalid or inactive API Key", "authentication_error", 401);
    }

    const user = apiKey.user;
    if (user.isBanned) {
      return anthropicError("Your account has been suspended", "access_denied", 403);
    }
    // ADMIN users bypass the balance check.
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && user.balance < 0.0001) {
      return anthropicError("Insufficient balance", "insufficient_balance", 402);
    }

    // 2. Parse body
    const body = await req.json();
    const requestedModel = body?.model;
    if (!requestedModel) {
      return anthropicError("Missing 'model' field", "invalid_request_error", 400);
    }

    // 3. Resolve model -> provider
    let modelId = requestedModel;
    if (requestedModel === "claude-opus-4-7") {
      modelId = "claude-opus-4.7";
    }

    const resolved = await resolveModel(prisma, modelId);
    if (!resolved) {
      return anthropicError(
        `Model '${requestedModel}' is not available.`,
        "model_not_found",
        404
      );
    }
    const { provider, model } = resolved;

    if (!provider.apiKeyCipher) {
      return anthropicError(
        `Provider '${provider.name}' has no API key configured`,
        "api_key_missing",
        503
      );
    }

    const upstreamKey = decryptSecret(provider.apiKeyCipher);

    // 4. Billing estimates & balance verification
    const discountRate = apiKey.user.discountRate ?? 1.0;
    const inputPrice = model.inputPricePer1k;
    const outputPrice = model.outputPricePer1k;

    const promptEstimate = estimatePromptTokens(body);
    const stream = body.stream !== undefined ? !!body.stream : true;
    const outputEstimate = stream ? Math.min(body.max_tokens ?? 1024, 2048) : 512;
    const estimatedCost = ((promptEstimate / 1000) * inputPrice + (outputEstimate / 1000) * outputPrice) * discountRate;

    if (!isAdmin && user.balance < estimatedCost) {
      return anthropicError("Insufficient balance for this generation", "insufficient_balance", 402);
    }

    // 5. Proxy call to upstream (KIE or other Anthropic-compatible provider)
    const cleanBase = provider.baseUrl.replace(/\/v1$/, "").replace(/\/+$/, "");
    const upstreamUrl = `${cleanBase}/claude/v1/messages`;

    const claudeHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${upstreamKey}`,  // KIE style
      "x-api-key": upstreamKey,                  // Anthropic native style
      "anthropic-version": "2023-06-01",
    };

    // Include extra headers if configured on the provider
    const extraHeaders = (provider.extraHeaders as Record<string, string> | null) ?? {};
    Object.assign(claudeHeaders, extraHeaders);

    // Strip platform-internal fields before forwarding
    const { thinkingFlag: _thinkingFlag, ...bodyToSend } = body as any;
    const payload = {
      ...bodyToSend,
      model: model.modelId,
    };

    // Retry up to 2 extra times for transient KIE errors (422 / 5xx).
    // KIE occasionally returns {"code":422,"msg":"The page does not exist"} during brief hiccups.
    let res: Response | null = null;
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        console.warn(`[Claude /messages] Retry attempt ${attempt} for ${model.modelId}`);
      }
      res = await fetch(upstreamUrl, {
        method: "POST",
        headers: claudeHeaders,
        body: JSON.stringify(payload),
      });
      if (res.ok) break;
      const retryable = res.status === 422 || res.status >= 500;
      if (!retryable) break;
      console.warn(`[Claude /messages] Attempt ${attempt + 1} got status ${res.status}`);
    }

    if (!res!.ok) {
      const errText = await res!.text();
      console.error(`[Claude /messages] Upstream error after ${maxAttempts} attempts:`, errText.slice(0, 500));
      let errJson;
      try { errJson = JSON.parse(errText); } catch { /* ignore */ }
      return NextResponse.json(
        errJson || { error: { message: errText || "Upstream request failed", type: "upstream_error" } },
        { status: res!.status }
      );
    }


    // 6. Charging and Response routing
    if (stream) {
      // Stream charging: upfront based on prompt + max_tokens heuristic
      await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, promptEstimate, outputEstimate, estimatedCost);

      return new Response(res!.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: actual token billing
    const data = await res!.json();
    const inputTokens = data?.usage?.input_tokens ?? promptEstimate;
    const outputTokens = data?.usage?.output_tokens ?? 0;
    const finalCost = ((inputTokens / 1000) * inputPrice + (outputTokens / 1000) * outputPrice) * discountRate;

    await chargeUser(prisma, apiKey.id, user.id, provider.slug, model.modelId, inputTokens, outputTokens, finalCost);

    return NextResponse.json(data);


  } catch (err: any) {
    console.error("Claude Gateway error:", err);
    return anthropicError("Internal Server Error: " + err.message, "internal_server_error", 500);
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

function estimatePromptTokens(body: any): number {
  let chars = 0;
  for (const m of body.messages || []) {
    if (typeof m.content === "string") {
      chars += m.content.length;
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p && typeof p.text === "string") {
          chars += p.text.length;
        }
      }
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
  inputTokens: number,
  outputTokens: number,
  cost: number
) {
  try {
    await chargeUserWithSubscription({
      apiKeyId,
      userId,
      providerSlug,
      modelId,
      totalTokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      cost
    });
  } catch (e) {
    console.error("chargeUser failed:", e);
  }
}

function anthropicError(message: string, type = "invalid_request_error", status = 400) {
  return NextResponse.json({
    error: {
      message,
      type
    }
  }, { status });
}
