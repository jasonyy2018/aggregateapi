import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { DashboardOverviewClient } from "@/components/dashboard-overview-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const prisma = getPrisma();
  
  // 1. Get user balance
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true }
  });

  // 2. Get recent usage (dummy for now until we have RequestLog table, or use BillingTransaction)
  // For now, let's fetch real billing transactions to show something real
  const transactions = await prisma.billingTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const stats = {
    balance: user?.balance || 0,
    requests: 0, // Placeholder for real request logs
    latency: 0,   // Placeholder
  };

  const recentUsage = transactions.map(t => ({
    time: t.createdAt.toLocaleDateString(),
    model: t.type === 'TOPUP' ? 'Recharge' : 'API Usage',
    tokens: '-',
    cost: (t.type === 'TOPUP' ? '+' : '-') + '$' + t.amount.toFixed(4)
  }));

  return (
    <DashboardOverviewClient 
      userName={session?.user?.name} 
      stats={stats}
      recentUsage={recentUsage}
    />
  );
}
