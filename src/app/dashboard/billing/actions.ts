"use server";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface Plan {
  id: string;
  nameEn: string;
  nameZh: string;
  price: number;
  durationDays: number;
  providerSlug: string;
  modelId?: string;
  tokenLimit: number | null; // null means unlimited
  descriptionEn: string;
  descriptionZh: string;
}

export const AVAILABLE_PLANS: Plan[] = [
  {
    id: "openai-monthly-unlimited",
    nameZh: "OpenAI 不限量包月套餐",
    nameEn: "OpenAI Unlimited Monthly Plan",
    price: 15.0,
    durationDays: 30,
    providerSlug: "openai",
    tokenLimit: null,
    descriptionZh: "30天内无限量额度使用所有 OpenAI 模型（包含 GPT-4o, GPT-4o-mini 等）。",
    descriptionEn: "Unlimited tokens for all OpenAI models (GPT-4o, GPT-4o-mini, etc.) for 30 days."
  },
  {
    id: "openai-yearly-unlimited",
    nameZh: "OpenAI 不限量包年套餐",
    nameEn: "OpenAI Unlimited Yearly Plan",
    price: 150.0,
    durationDays: 365,
    providerSlug: "openai",
    tokenLimit: null,
    descriptionZh: "365天内无限量额度使用所有 OpenAI 模型，超值年付特惠！",
    descriptionEn: "Unlimited tokens for all OpenAI models for 365 days, premium yearly discount."
  },
  {
    id: "deepseek-monthly-10m",
    nameZh: "DeepSeek 1000万 Token 包月套餐",
    nameEn: "DeepSeek 10M Tokens Monthly Plan",
    price: 5.0,
    durationDays: 30,
    providerSlug: "deepseek",
    tokenLimit: 10000000,
    descriptionZh: "30天内可使用 DeepSeek 官方模型共 10,000,000 Token 额度。",
    descriptionEn: "Use up to 10,000,000 tokens for all DeepSeek models for 30 days."
  },
  {
    id: "deepseek-yearly-120m",
    nameZh: "DeepSeek 1.2亿 Token 包年套餐",
    nameEn: "DeepSeek 120M Tokens Yearly Plan",
    price: 45.0,
    durationDays: 365,
    providerSlug: "deepseek",
    tokenLimit: 120000000,
    descriptionZh: "365天内可使用 DeepSeek 官方模型共 120,000,000 Token 额度。",
    descriptionEn: "Use up to 120,000,000 tokens for all DeepSeek models for 365 days."
  }
];

export async function buySubscription(planId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const userId = session.user.id;
  const plan = AVAILABLE_PLANS.find(p => p.id === planId);
  if (!plan) {
    return { error: "Plan not found" };
  }

  const prisma = getPrisma();

  try {
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

    // Resolve provider slug to providerId
    const provider = await prisma.provider.findUnique({
      where: { slug: plan.providerSlug }
    });

    if (!provider) {
      return { error: `Provider "${plan.providerSlug}" is not configured on the platform yet.` };
    }

    // Resolve modelId if specified
    let providerModelId: string | null = null;
    if (plan.modelId) {
      const pm = await prisma.providerModel.findFirst({
        where: { providerId: provider.id, modelId: plan.modelId }
      });
      if (pm) {
        providerModelId = pm.id;
      }
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
          providerId: provider.id,
          providerModelId: providerModelId,
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
          amount: -plan.price, // negative amount representing cost/purchase
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
