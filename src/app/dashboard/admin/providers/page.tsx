import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminProvidersClient } from "@/components/admin-providers-client";
import { getPlatformSettings } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const prisma = getPrisma();
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== "ADMIN") redirect("/dashboard");

  const [providers, settings] = await Promise.all([
    prisma.provider.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { models: { orderBy: [{ sortOrder: "asc" }, { modelId: "asc" }] } },
    }),
    getPlatformSettings(prisma),
  ]);

  // Redact the cipher before sending to the client
  const safe = providers.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKeyHint: p.apiKeyHint,
    hasApiKey: Boolean(p.apiKeyCipher),
    logoUrl: p.logoUrl,
    description: p.description,
    isEnabled: p.isEnabled,
    sortOrder: p.sortOrder,
    extraHeaders: p.extraHeaders as Record<string, string> | null,
    models: p.models.map((m) => ({
      id: m.id,
      providerId: m.providerId,
      modelId: m.modelId,
      displayName: m.displayName,
      description: m.description,
      contextLength: m.contextLength,
      costInputPer1k: m.costInputPer1k,
      costOutputPer1k: m.costOutputPer1k,
      inputPricePer1k: m.inputPricePer1k,
      outputPricePer1k: m.outputPricePer1k,
      isEnabled: m.isEnabled,
      sortOrder: m.sortOrder,
      capabilities: m.capabilities,
    })),
  }));

  return (
    <AdminProvidersClient
      providers={safe}
      settings={{
        defaultMarginPct: settings.defaultMarginPct,
        minMarginPct: settings.minMarginPct,
        autoApplyMargin: settings.autoApplyMargin,
      }}
    />
  );
}
