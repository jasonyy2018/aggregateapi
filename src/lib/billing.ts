import { getPrisma } from "./prisma";

interface ChargeParams {
  apiKeyId: string;
  userId: string;
  providerSlug: string;
  modelId: string;
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  cost: number; // Standard cost calculated without subscription
}

/**
 * Charge a user for model usage, taking into account any active monthly packages (UserSubscription).
 * Supports:
 * - Unlimited tokens (tokenLimit === null)
 * - Limited tokens (deduct from subscription first, excess billed standard rate from user balance)
 */
export async function chargeUserWithSubscription(params: ChargeParams) {
  const prisma = getPrisma();
  const {
    apiKeyId,
    userId,
    providerSlug,
    modelId,
    totalTokens,
    inputTokens = 0,
    outputTokens = 0,
    cost
  } = params;

  try {
    const now = new Date();

    // 1. Fetch user to check role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Admin users bypass billing completely
    if (user.role === "ADMIN") {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: now }
      });
      return { chargedAmount: 0, subscriptionUsed: false, tokensDeductedFromSub: 0 };
    }

    // 2. Resolve provider slug to database id
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug }
    });

    let activeSubscription = null;

    if (provider) {
      // Find model id inside this provider
      const providerModel = await prisma.providerModel.findFirst({
        where: { providerId: provider.id, modelId: modelId }
      });

      // Priority 1: Check if there's a specific package for this provider model
      if (providerModel) {
        activeSubscription = await prisma.userSubscription.findFirst({
          where: {
            userId,
            providerModelId: providerModel.id,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now }
          }
        });
      }

      // Priority 2: Check if there's a package for the provider generally (all its models)
      if (!activeSubscription) {
        activeSubscription = await prisma.userSubscription.findFirst({
          where: {
            userId,
            providerId: provider.id,
            providerModelId: null,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now }
          }
        });
      }
    }

    let chargedAmount = cost;
    let subscriptionUsed = false;
    let tokensDeductedFromSub = 0;

    if (activeSubscription) {
      subscriptionUsed = true;
      if (activeSubscription.tokenLimit === null) {
        // Case A: Unlimited subscription
        chargedAmount = 0.0;
        tokensDeductedFromSub = totalTokens;
      } else {
        // Case B: Limited subscription
        const remaining = Math.max(0, activeSubscription.tokenLimit - activeSubscription.tokenUsed);
        if (remaining >= totalTokens) {
          // Fully covered by subscription package
          chargedAmount = 0.0;
          tokensDeductedFromSub = totalTokens;
        } else if (remaining > 0) {
          // Partially covered
          tokensDeductedFromSub = remaining;
          const excess = totalTokens - remaining;
          // Calculate proportional charge for the excess tokens
          chargedAmount = totalTokens > 0 ? cost * (excess / totalTokens) : 0;
        } else {
          // Fully exhausted, charge the standard cost from balance
          chargedAmount = cost;
          tokensDeductedFromSub = 0;
        }
      }
    }

    // 3. Write updates inside transaction to avoid race conditions
    await prisma.$transaction(async (tx) => {
      // Re-check balance inside transaction for atomicity
      if (chargedAmount > 0) {
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true }
        });
        if (!currentUser || currentUser.balance < chargedAmount) {
          throw new Error("insufficient_balance");
        }
      }

      if (activeSubscription && tokensDeductedFromSub > 0) {
        await tx.userSubscription.update({
          where: { id: activeSubscription.id },
          data: { tokenUsed: { increment: tokensDeductedFromSub } }
        });
      }

      if (chargedAmount > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { balance: { decrement: chargedAmount } }
        });
      }

      await tx.usageLog.create({
        data: {
          userId,
          model: modelId,
          provider: providerSlug,
          tokens: totalTokens,
          inputTokens,
          outputTokens,
          cost: chargedAmount
        }
      });

      await tx.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: now }
      });
    });

    return { chargedAmount, subscriptionUsed, tokensDeductedFromSub };
  } catch (err) {
    console.error("chargeUserWithSubscription failed:", err);
    throw err;
  }
}
