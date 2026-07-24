import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/tasks/history
 * Fetches user's tasks (Image/Video/Music) and chat dialogues created within the last 7 days.
 * Supports session auth (dashboard/playground) and Bearer API Key auth.
 */
export async function GET(req: Request) {
  const prisma = getPrisma();
  try {
    let userId: string | undefined;

    // 1. Session auth (Playground UI)
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // 2. Bearer token
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const apiKey = await prisma.apiKey.findUnique({
          where: { key: token },
          select: { userId: true },
        });
        if (apiKey) userId = apiKey.userId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 3. Query tasks from the last 7 days
    const tasks = await prisma.taskLog.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // 4. Query chat logs from the last 7 days
    const chats = await prisma.chatLog.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        taskId: t.taskId,
        model: t.model,
        providerSlug: t.provider,
        prompt: t.prompt,
        status: t.status,
        url: t.resultUrls?.[0] || "",
        resultUrls: t.resultUrls,
        failMsg: t.failMsg,
        timestamp: t.createdAt.toLocaleString(),
        createdAtMs: t.createdAt.getTime(),
      })),
      chats: chats.map((c) => ({
        id: c.id,
        model: c.model,
        userPrompt: c.userPrompt,
        assistantMsg: c.assistantMsg,
        timestamp: c.createdAt.toLocaleString(),
        createdAtMs: c.createdAt.getTime(),
      })),
    });
  } catch (err: any) {
    console.error("Fetch Task History error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
