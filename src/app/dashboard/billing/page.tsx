import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { BillingClient } from "../../../components/billing-client";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) return null;

  const prisma = getPrisma();
  
  // Fetch real balance
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true }
  });

  // Fetch real transaction history
  const transactions = await prisma.billingTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  const history = transactions.map(t => ({
    date: t.createdAt.toISOString().split('T')[0],
    type: t.type, // 'TOPUP' or 'USAGE'
    amount: (t.type === 'TOPUP' ? '+' : '-') + '$' + t.amount.toFixed(2),
    status: t.status, // 'SUCCESS', 'PENDING', etc.
    color: t.type === 'TOPUP' ? 'text-green-500' : 'text-text-main'
  }));

  return (
    <BillingClient 
      initialBalance={user?.balance || 0} 
      history={history} 
    />
  );
}
