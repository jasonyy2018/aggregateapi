import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { queryTaskStatus } from "@/lib/multimodal-gateway";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
    });
    if (!apiKey || !apiKey.isActive) {
      return openaiError("Invalid or inactive API Key", "invalid_request_error", 401);
    }

    // 2. Parse query params
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const providerSlug = searchParams.get("providerSlug");

    if (!taskId || !providerSlug) {
      return openaiError("Missing 'taskId' or 'providerSlug' query parameters", "invalid_request_error", 400);
    }

    // 3. Resolve provider
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
    });
    if (!provider || !provider.isEnabled) {
      return openaiError(`Provider '${providerSlug}' not found or is disabled`, "provider_not_found", 404);
    }

    if (!provider.apiKeyCipher) {
      return openaiError(`Provider '${provider.name}' has no API key configured`, "api_key_missing", 503);
    }

    // 4. Decrypt & Query
    const upstreamKey = decryptSecret(provider.apiKeyCipher);
    const status = await queryTaskStatus({
      provider,
      apiKey: upstreamKey,
      taskId,
    });

    // Update TaskLog in DB if state is terminal (success or fail)
    if (status.state === "success" || status.state === "fail") {
      await prisma.taskLog.update({
        where: { taskId },
        data: {
          status: status.state,
          resultUrls: status.resultUrls || [],
          failMsg: status.failMsg || null,
        },
      }).catch(() => {});
    }

    return NextResponse.json(status);
  } catch (err: any) {
    console.error("Task Status Query error:", err);
    return openaiError("Internal Server Error: " + err.message, "internal_server_error", 500);
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
