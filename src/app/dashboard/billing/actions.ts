"use server";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function buySubscription(planId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const userId = session.user.id;
  const prisma = getPrisma();

  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId, isActive: true },
      include: { provider: true }
    });

    if (!plan) {
      return { error: "Plan not found or is currently inactive." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      return { error: "User not found" };
    }

    if (user.balance < plan.price) {
      return { error: "Insufficient balance. Please top up your account." };
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    await prisma.$transaction([
      // Deduct balance
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: plan.price } }
      }),
      // Create Subscription
      prisma.userSubscription.create({
        data: {
          userId,
          providerId: plan.providerId,
          providerModelId: plan.providerModelId,
          planId: plan.id,
          tokenLimit: plan.tokenLimit,
          price: plan.price,
          startDate,
          endDate,
          isActive: true
        }
      }),
      // Create transaction record
      prisma.billingTransaction.create({
        data: {
          userId,
          amount: -plan.price,
          type: "SUBSCRIPTION",
          status: "SUCCESS",
          providerId: `Purchased package: ${plan.nameEn}`
        }
      })
    ]);

    revalidatePath("/dashboard/billing");
    return { success: true };
  } catch (error: any) {
    console.error("buySubscription failed:", error);
    return { error: error.message || "Failed to process purchase" };
  }
}

