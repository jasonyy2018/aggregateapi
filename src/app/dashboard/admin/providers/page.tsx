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

  // Check admin role — try by id first, then email
  let me: { role: string } | null = null;
  try {
    me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (!me && session.user.email) {
      me = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      });
    }
  } catch (err) {
    console.error("[providers] DB error checking role:", err);
    redirect("/dashboard");
  }
  if (me?.role !== "ADMIN") redirect("/dashboard");

  let safe: Parameters<typeof AdminProvidersClient>[0]["providers"] = [];
  let settingsData = { defaultMarginPct: 0.2, minMarginPct: 0.2, autoApplyMargin: true };

  try {
    const [providers, settings] = await Promise.all([
      prisma.provider.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { models: { orderBy: [{ sortOrder: "asc" }, { modelId: "asc" }] } },
      }),
      getPlatformSettings(prisma),
    ]);

    // Redact the cipher before sending to the client
    safe = providers.map((p) => ({
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

    settingsData = {
      defaultMarginPct: settings.defaultMarginPct,
      minMarginPct: settings.minMarginPct,
      autoApplyMargin: settings.autoApplyMargin,
    };
  } catch (err) {
    console.error("[providers] DB error loading providers:", err);
  }

  return (
    <AdminProvidersClient
      providers={safe}
      settings={settingsData}
    />
  );
}
