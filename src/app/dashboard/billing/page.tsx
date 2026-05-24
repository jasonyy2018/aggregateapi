import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { BillingClient } from "../../../components/billing-client";
import { getOrCreateReferralCode } from "@/lib/referral";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) return null;

  const prisma = getPrisma();
  
  // 1. Fetch real balance and referral code
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, balance: true, referralCode: true }
  });

  let referralCode = user?.referralCode || "";
  if (user && !user.referralCode) {
    referralCode = await getOrCreateReferralCode(prisma, user.id);
  }

  // 2. Fetch referral statistics
  const referralCount = await prisma.user.count({
    where: { referredById: session.user.id }
  });

  const referralEarningsAgg = await prisma.billingTransaction.aggregate({
    _sum: { amount: true },
    where: {
      userId: session.user.id,
      status: "SUCCESS",
      providerId: { startsWith: "REF_BONUS_" }
    }
  });
  const referralEarnings = referralEarningsAgg._sum.amount || 0;

  // 3. Fetch real transaction history
  const transactions = await prisma.billingTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  const history = transactions.map(t => {
    const isRefBonus = t.providerId?.startsWith("REF_BONUS_");
    let displayType = t.type === 'TOPUP' ? 'Recharge' : 'API Usage';
    if (isRefBonus) displayType = 'Referral Bonus';

    return {
      date: t.createdAt.toISOString().split('T')[0],
      type: displayType, 
      amount: (t.type === 'TOPUP' || isRefBonus ? '+' : '-') + '$' + t.amount.toFixed(2),
      status: t.status, 
      color: t.type === 'TOPUP' || isRefBonus ? 'text-green-500' : 'text-text-main'
    };
  });

  return (
    <BillingClient 
      initialBalance={user?.balance || 0} 
      history={history}
      referralCode={referralCode}
      referralCount={referralCount}
      referralEarnings={referralEarnings}
    />
  );
}
