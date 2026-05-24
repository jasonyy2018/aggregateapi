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

  // Map to clean format for client component
  const models = dbModels.map((m) => ({
    id: `${m.provider.slug}/${m.modelId}`,
    displayName: m.displayName,
    capabilities: m.capabilities,
    providerProtocol: m.provider.protocol,
    providerSlug: m.provider.slug,
    modelId: m.modelId,
    pricing: m.inputPricePer1k,
  }));

  return (
    <PlaygroundClient
      apiKey={apiKey?.key || null}
      models={models}
      userEmail={session.user.email || ""}
    />
  );
}
