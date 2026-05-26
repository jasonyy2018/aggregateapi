import { NextResponse } from "next/server";
import { getPublicRegistry } from "@/lib/model-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/model-registry
 *
 * Returns the full model routing registry so clients can discover:
 * - Which endpoint/protocol each model uses
 * - What upstream model ID is used
 * - Billing mode
 */
export async function GET() {
  const registry = getPublicRegistry();

  // Group by protocol for easier reading
  const grouped: Record<string, any[]> = {};
  for (const [modelId, entry] of Object.entries(registry)) {
    const g = entry.protocol;
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({
      modelId,
      upstreamModelId: entry.upstreamModelId,
      billing: entry.billing,
      ...(entry.inputPatch ? { inputPatch: entry.inputPatch } : {}),
      ...(entry.description ? { description: entry.description } : {}),
    });
  }

  return NextResponse.json({
    total: Object.keys(registry).length,
    protocols: {
      "openai-chat":    { description: "Standard LLM → /v1/chat/completions", endpoint: "/v1/chat/completions" },
      "anthropic-chat": { description: "Claude (Anthropic format) → /claude/v1/messages", endpoint: "/claude/v1/messages" },
      "kie-task-image": { description: "Image generation async task → /api/v1/jobs/createTask", endpoint: "/api/v1/jobs/createTask" },
      "kie-task-video": { description: "Video generation async task → /api/v1/jobs/createTask", endpoint: "/api/v1/jobs/createTask" },
      "kie-task-music": { description: "Music generation async task → /api/v1/jobs/createTask", endpoint: "/api/v1/jobs/createTask" },
    },
    models: grouped,
  });
}
