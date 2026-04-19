import { getPrisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { dictionaries } from "@/lib/i18n"
import { cookies } from "next/headers"
import { AdminUsersTable } from "@/components/admin-users-table"

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/")

  const prisma = getPrisma()
  const userRole = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  // Basic RBAC
  if (userRole?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const cookieStore = await cookies()
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en"
  const t = dictionaries[locale]

  // Compute Aggregations
  // 1. Total Users
  const totalUsers = await prisma.user.count()
  
  // 2. Total Revenue (amount sum of SUCCESS topups)
  const revenueAgg = await prisma.billingTransaction.aggregate({
    _sum: { amount: true },
    where: { status: "SUCCESS", type: "TOPUP" }
  })
  const totalRevenue = revenueAgg._sum.amount || 0

  // 3. Total Tokens
  const tokenAgg = await prisma.usageLog.aggregate({
    _sum: { tokens: true }
  })
  const totalTokens = tokenAgg._sum.tokens || 0

  // 4. Active API Keys
  const activeKeys = await prisma.apiKey.count({
    where: { isActive: true }
  })

  // 5. Recent Users (or top 50 users)
  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, name: true, email: true, role: true, balance: true, isBanned: true, createdAt: true }
  })

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">{t.adminPage.title}</h1>
        <p className="text-text-muted">{t.adminPage.subtitle}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-sm text-text-muted mb-2 font-medium">{t.adminPage.totalUsers}</p>
          <p className="text-3xl font-bold text-text-main">{totalUsers}</p>
        </div>
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-sm text-text-muted mb-2 font-medium">{t.adminPage.totalRevenue}</p>
          <p className="text-3xl font-bold text-brand-primary">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-sm text-text-muted mb-2 font-medium">{t.adminPage.totalTokens}</p>
          <p className="text-3xl font-bold text-text-main">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-sm text-text-muted mb-2 font-medium">{t.adminPage.activeKeys}</p>
          <p className="text-3xl font-bold text-text-main">{activeKeys}</p>
        </div>
      </div>

      {/* Interactive Users Table */}
      <div>
        <h2 className="text-lg font-bold text-text-main mb-4">{t.adminPage.recentUsersTitle}</h2>
        <AdminUsersTable users={recentUsers} />
      </div>
    </div>
  )
}
