import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { PlaygroundClient } from "@/components/playground-client";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const prisma = getPrisma();
  
  // 1. Get first active API Key of the user
  const apiKey = await prisma.apiKey.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  // 2. Get list of enabled models
  const dbModels = await prisma.providerModel.findMany({
    where: { isEnabled: true, provider: { isEnabled: true } },
    include: { provider: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Map to clean format for client component with smart capability inference
  const models = dbModels.map((m) => {
    const caps = new Set(m.capabilities);
    const mid = m.modelId.toLowerCase();
    const dname = m.displayName.toLowerCase();

    // 1. Infer Video
    if (
      mid.includes("video") ||
      mid.includes("seedance") ||
      mid.includes("veo") ||
      mid.includes("kling") ||
      mid.includes("runway") ||
      mid.includes("hailuo") ||
      mid.includes("wan") ||
      mid.includes("happyhorse") ||
      mid.includes("luma") ||
      mid.includes("sora") ||
      mid.includes("vidu") ||
      dname.includes("video") ||
      dname.includes("视频")
    ) {
      caps.add("video");
    }

    // 2. Infer Image
    if (
      mid.includes("image") ||
      mid.includes("flux") ||
      mid.includes("midjourney") ||
      mid.includes("mj_") ||
      mid.includes("nano-banana") ||
      mid.includes("dall-e") ||
      mid.includes("sdxl") ||
      mid.includes("stable-diffusion") ||
      mid.includes("topaz") ||
      mid.includes("imagen") ||
      mid.includes("recraft") ||
      dname.includes("image") ||
      dname.includes("绘画") ||
      dname.includes("生图") ||
      dname.includes("画作")
    ) {
      caps.add("image");
    }

    // 3. Infer Music / Audio
    if (
      mid.includes("music") ||
      mid.includes("suno") ||
      mid.includes("udio") ||
      mid.includes("audio") ||
      dname.includes("music") ||
      dname.includes("音乐") ||
      dname.includes("音频")
    ) {
      caps.add("music");
    }

    return {
      id: `${m.provider.slug}/${m.modelId}`,
      displayName: m.displayName,
      capabilities: Array.from(caps),
      providerProtocol: m.provider.protocol,
      providerSlug: m.provider.slug,
      providerName: m.provider.name,
      modelId: m.modelId,
      pricing: m.inputPricePer1k,
    };
  });

  return (
    <PlaygroundClient
      apiKey={apiKey?.key || null}
      models={models}
      userEmail={session.user.email || ""}
    />
  );
}
