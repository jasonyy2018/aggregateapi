import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ModelsBrowserClient } from "@/components/models-browser-client";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  let rows: Parameters<typeof ModelsBrowserClient>[0]["providers"] = [];

  try {
    const prisma = getPrisma();

    // Only show models whose Provider AND Model are both enabled
    const providers = await prisma.provider.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        models: {
          where: { isEnabled: true },
          orderBy: [{ sortOrder: "asc" }, { modelId: "asc" }],
        },
      },
    });

    rows = providers
      .filter((p) => p.models.length > 0)
      .map((p) => ({
        providerId: p.id,
        providerName: p.name,
        providerSlug: p.slug,
        logoUrl: p.logoUrl,
        protocol: p.protocol,
        description: p.description,
        models: p.models.map((m) => ({
          id: m.id,
          modelId: m.modelId,
          displayName: m.displayName,
          description: m.description,
          contextLength: m.contextLength,
          inputPricePer1k: m.inputPricePer1k,
          outputPricePer1k: m.outputPricePer1k,
          capabilities: m.capabilities,
        })),
      }));
  } catch (err) {
    console.error("[models] DB error loading models:", err);
  }

  return <ModelsBrowserClient providers={rows} />;
}
