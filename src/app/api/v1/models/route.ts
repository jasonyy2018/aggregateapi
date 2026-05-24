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
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  const key = await prisma.apiKey.findUnique({ where: { key: token } });
  if (!key || !key.isActive) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const providers = await prisma.provider.findMany({
    where: { isEnabled: true },
    include: {
      models: { where: { isEnabled: true } },
    },
  });

  const data: any[] = [];
  const seenRawIds = new Set<string>();

  for (const p of providers) {
    for (const m of p.models) {
      // 1. Add raw clean modelId (e.g. "gpt-4o", "deepseek-chat") for standard client dropdown matches
      if (!seenRawIds.has(m.modelId)) {
        seenRawIds.add(m.modelId);
        data.push({
          id: m.modelId,
          object: "model",
          created: Math.floor(m.createdAt.getTime() / 1000),
          owned_by: p.slug,
          display_name: m.displayName,
          context_length: m.contextLength,
          pricing: {
            prompt: m.inputPricePer1k,
            completion: m.outputPricePer1k,
          },
          capabilities: m.capabilities,
        });
      }

      // 2. Add provider-qualified modelId (e.g. "kie/gpt-4o") for explicit targeted routing
      data.push({
        id: `${p.slug}/${m.modelId}`,
        object: "model",
        created: Math.floor(m.createdAt.getTime() / 1000),
        owned_by: p.slug,
        display_name: `${m.displayName} (${p.name})`,
        context_length: m.contextLength,
        pricing: {
          prompt: m.inputPricePer1k,
          completion: m.outputPricePer1k,
        },
        capabilities: m.capabilities,
      });
    }
  }

  return NextResponse.json({ object: "list", data });
}
