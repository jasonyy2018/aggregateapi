import type { getPrisma } from "./prisma";

/**
 * Award the inviter (referredBy) a 10% commission of the invitee's successful recharge.
 * Deducted balance is credited as USD and logged.
 */
export async function rewardReferrer(
  prisma: ReturnType<typeof getPrisma>,
  userId: string,
  rechargeAmount: number
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    if (user && user.referredById) {
      const bonusAmount = parseFloat((rechargeAmount * 0.10).toFixed(4)); // 10% commission
      if (bonusAmount > 0) {
        const outTradeNo = `REF_BONUS_${Date.now()}_${userId.substring(0, 5)}`;
        
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.referredById },
            data: { balance: { increment: bonusAmount } },
          }),
          prisma.billingTransaction.create({
            data: {
              userId: user.referredById,
              amount: bonusAmount,
              type: "TOPUP",
              status: "SUCCESS",
              providerId: outTradeNo,
            },
          }),
        ]);
        console.log(`[REFERRAL] Awarded user ${user.referredById} a commission of $${bonusAmount} for invitee ${userId}'s recharge of $${rechargeAmount}`);
      }
    }
  } catch (err) {
    console.error("[REFERRAL] Error in rewardReferrer:", err);
  }
}

/**
 * Generate a unique, short, human-friendly invitation code for a user if they don't have one.
 */
export async function getOrCreateReferralCode(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (user?.referralCode) {
    return user.referralCode;
  }

  // Generate a clean code, e.g. REF-XXXX
  const cleanCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: cleanCode },
      select: { referralCode: true },
    });
    return updated.referralCode || cleanCode;
  } catch {
    // Retry once in case of a unique constraint conflict
    const fallbackCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: fallbackCode },
      select: { referralCode: true },
    });
    return updated.referralCode || fallbackCode;
  }
}

/**
 * Link an invitee to their inviter using the inviter's referral code.
 */
export async function linkReferral(
  prisma: ReturnType<typeof getPrisma>,
  inviteeId: string,
  referralCode: string
): Promise<boolean> {
  try {
    const inviter = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!inviter || inviter.id === inviteeId) {
      return false; // Code not found or user is trying to invite themselves
    }

    // Link the user
    await prisma.user.update({
      where: { id: inviteeId },
      data: { referredById: inviter.id },
    });
    console.log(`[REFERRAL] Successfully linked invitee ${inviteeId} to inviter ${inviter.id}`);
    return true;
  } catch (err) {
    console.error("[REFERRAL] linkReferral failed:", err);
    return false;
  }
}
