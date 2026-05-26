import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public diagnostic endpoint — no authentication required.
 * Use this to verify:
 *   1. The server URL is correct
 *   2. Database is connected
 *   3. How many providers/models are loaded
 *   4. Whether a specific API key is valid (without exposing sensitive data)
 *
 * GET /v1/ping
 * GET /v1/ping?key=<your-api-key>   → also validates the key
 */
export async function GET(req: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);
  const testKey = searchParams.get("key");

  // 1. Database health
  let dbOk = false;
  let providerCount = 0;
  let modelCount = 0;
  let llmModelCount = 0;
  try {
    const [providers, models] = await Promise.all([
      prisma.provider.count({ where: { isEnabled: true } }),
      prisma.providerModel.count({ where: { isEnabled: true } }),
    ]);
    providerCount = providers;
    // Count LLM-only models (exclude image/video/music)
    const allModels = await prisma.providerModel.findMany({
      where: { isEnabled: true, provider: { isEnabled: true } },
      select: { capabilities: true },
    });
    llmModelCount = allModels.filter(
      (m) => !m.capabilities.some((c) => ["image", "video", "music"].includes(c))
    ).length;
    modelCount = models;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // 2. Optional key validation
  let keyStatus: string | null = null;
  let keyRole: string | null = null;
  let keyBalance: number | null = null;
  if (testKey) {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { key: testKey },
        include: { user: { select: { role: true, balance: true, isBanned: true } } },
      });
      if (!apiKey) {
        keyStatus = "INVALID — API key not found in database";
      } else if (!apiKey.isActive) {
        keyStatus = "INVALID — API key is disabled";
      } else if (apiKey.user.isBanned) {
        keyStatus = "BLOCKED — Account is suspended";
      } else {
        keyRole = apiKey.user.role;
        keyBalance = apiKey.user.balance;
        if (apiKey.user.role !== "ADMIN" && apiKey.user.balance < 0.0001) {
          keyStatus = `VALID but BALANCE IS ZERO (${apiKey.user.balance}) — top up your account to use the API`;
        } else {
          keyStatus = "VALID ✓";
        }
      }
    } catch {
      keyStatus = "ERROR — could not validate key (DB error)";
    }
  }

  const result: any = {
    status: dbOk ? "ok" : "error",
    server: "aggregateapi gateway",
    timestamp: new Date().toISOString(),
    database: dbOk ? "connected" : "unreachable",
    providers_enabled: providerCount,
    models_total_enabled: modelCount,
    models_llm_for_chat: llmModelCount,
    hint:
      llmModelCount === 0
        ? "⚠ No LLM chat models are enabled. Import models in Admin → Providers → Import Models."
        : `${llmModelCount} LLM model(s) available for chat completions.`,
    cherry_studio_setup: {
      base_url: "https://aapi.togomol.com/v1",
      api_key: "Your platform API key from Dashboard → API Keys",
      note: "Do NOT use the KIE API key here. Create a platform key in your dashboard.",
    },
  };

  if (testKey !== null) {
    result.key_check = {
      status: keyStatus,
      role: keyRole,
      balance: keyBalance,
    };
  }

  return NextResponse.json(result, {
    status: dbOk ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
