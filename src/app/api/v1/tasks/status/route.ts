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
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
    });
    if (!apiKey || !apiKey.isActive) {
      return NextResponse.json({ error: "Invalid or inactive API Key" }, { status: 401 });
    }

    // 2. Parse query params
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const providerSlug = searchParams.get("providerSlug");

    if (!taskId || !providerSlug) {
      return NextResponse.json({ error: "Missing 'taskId' or 'providerSlug' query parameters" }, { status: 400 });
    }

    // 3. Resolve provider
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
    });
    if (!provider || !provider.isEnabled) {
      return NextResponse.json({ error: `Provider '${providerSlug}' not found or is disabled` }, { status: 404 });
    }

    if (!provider.apiKeyCipher) {
      return NextResponse.json({ error: `Provider '${provider.name}' has no API key configured` }, { status: 503 });
    }

    // 4. Decrypt & Query
    const upstreamKey = decryptSecret(provider.apiKeyCipher);
    const status = await queryTaskStatus({
      provider,
      apiKey: upstreamKey,
      taskId,
    });

    return NextResponse.json(status);
  } catch (err: any) {
    console.error("Task Status Query error:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
