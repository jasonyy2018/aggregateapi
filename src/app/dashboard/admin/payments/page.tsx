import { getPrisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { dictionaries } from "@/lib/i18n"
import { cookies } from "next/headers"
import { AdminPaymentsClient } from "@/components/admin-payments-client"

export default async function AdminPaymentsPage() {
  const session = await auth()
  if (!session?.user) redirect("/")

  const prisma = getPrisma()

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const cookieStore = await cookies()
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en"
  const t = dictionaries[locale]

  // Fetch current settings
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "singleton" }
  }) || {
    defaultMarginPct: 0.2,
    minMarginPct: 0.2,
    autoApplyMargin: true,
    paypalClientId: "",
    alipayAppId: "",
    alipayPublicKey: ""
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">{t.providers.paymentSettingsTitle}</h1>
        <p className="text-text-muted">{t.providers.paymentSettingsDesc}</p>
      </div>

      <AdminPaymentsClient settings={settings as any} />
    </div>
  )
}
