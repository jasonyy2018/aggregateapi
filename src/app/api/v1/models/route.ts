import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * OpenAI-compatible /v1/models endpoint.
 *
 * Lists every model where BOTH the provider and the model itself are enabled.
 * The returned `id` is a slash-addressed form "<provider-slug>/<model-id>"
 * so that clients can target a specific provider even if the same model id
 * is exposed by multiple upstream vendors.
 */
export async function GET(req: Request) {
  const prisma = getPrisma();

  // Require a valid API key, just like /chat/completions
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return openaiError("Missing or invalid Authorization header", "invalid_request_error", 401);
  }
  const token = authHeader.slice(7).trim();
  const key = await prisma.apiKey.findUnique({ where: { key: token } });
  if (!key || !key.isActive) {
    return openaiError("Invalid API key", "invalid_request_error", 401);
  }

  const providers = await prisma.provider.findMany({
    where: { isEnabled: true },
    include: {
      models: { where: { isEnabled: true } },
    },
  });

  // Separate LLM models from non-LLM (image/video/music) so LLMs appear first in Cherry Studio
  const llmModels: any[] = [];
  const nonLlmModels: any[] = [];
  const seenRawIds = new Set<string>();

  // Capability → display tag mapping
  const capTag: Record<string, string> = {
    image: "[Image]",
    video: "[Video]",
    music: "[Music]",
  };

  for (const p of providers) {
    for (const m of p.models) {
      const nonLlmCap = m.capabilities.find((c) => ["image", "video", "music"].includes(c));
      const isNonLlm = Boolean(nonLlmCap);
      const tag = nonLlmCap ? (capTag[nonLlmCap] ?? "[Media]") : "";

      // 1. Add raw clean modelId once (deduped across providers)
      if (!seenRawIds.has(m.modelId)) {
        seenRawIds.add(m.modelId);
        const entry = {
          id: m.modelId,
          object: "model",
          created: Math.floor(m.createdAt.getTime() / 1000),
          owned_by: "system",
          display_name: isNonLlm ? `${tag} ${m.displayName}` : m.displayName,
          context_length: m.contextLength,
          pricing: {
            prompt: m.inputPricePer1k,
            completion: m.outputPricePer1k,
          },
          capabilities: m.capabilities,
        };
        if (isNonLlm) nonLlmModels.push(entry);
        else llmModels.push(entry);
      }

      // 2. Add provider-qualified modelId (e.g. "kie-oai/bytedance/seedance-2-mini") for explicit targeted routing
      const qualifiedEntry = {
        id: `${p.slug}/${m.modelId}`,
        object: "model",
        created: Math.floor(m.createdAt.getTime() / 1000),
        owned_by: "system",
        display_name: isNonLlm ? `${tag} ${m.displayName}` : m.displayName,
        context_length: m.contextLength,
        pricing: {
          prompt: m.inputPricePer1k,
          completion: m.outputPricePer1k,
        },
        capabilities: m.capabilities,
      };
      if (isNonLlm) nonLlmModels.push(qualifiedEntry);
      else llmModels.push(qualifiedEntry);
    }
  }

  // LLM models first, then image/video/music models
  const data = [...llmModels, ...nonLlmModels];

  return NextResponse.json({ object: "list", data });
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
