"use server";

import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// Verify admin status locally
async function ensureAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  
  const prisma = getPrisma();
  let dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // Fallback: lookup by email
  if (!dbUser && session.user.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
  }

  if (dbUser?.role !== "ADMIN") {
    throw new Error("Forbidden: Admin privileges required");
  }

  return prisma;
}

export async function adjustUserBalance(userId: string, amount: number) {
  try {
    const prisma = await ensureAdmin();

    if (isNaN(amount)) throw new Error("Invalid amount");

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } },
      }),
      prisma.billingTransaction.create({
        data: {
          userId,
          amount,
          type: "TOPUP", // We mark manual entries as TOPUP for generic handling
          status: "SUCCESS",
          providerId: `Manual adjustment by admin`,
        },
      }),
    ]);

    revalidatePath("/dashboard/admin");
    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function toggleUserBan(userId: string, isBanned: boolean) {
  try {
    const prisma = await ensureAdmin();

    await prisma.user.update({
      where: { id: userId },
      data: { isBanned },
    });

    revalidatePath("/dashboard/admin");
    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateUserDiscount(userId: string, discountRate: number) {
  try {
    const prisma = await ensureAdmin();

    if (isNaN(discountRate) || discountRate < 0 || discountRate > 1) {
      throw new Error("Invalid discount rate. Must be between 0.0 and 1.0");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { discountRate },
    });

    revalidatePath("/dashboard/admin");
    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateWikiSection(
  slug: string,
  titleEn: string,
  titleZh: string,
  contentEn: string,
  contentZh: string
) {
  try {
    const prisma = await ensureAdmin();

    if (!slug) throw new Error("Slug is required");

    await prisma.wikiSection.upsert({
      where: { slug },
      update: {
        titleEn,
        titleZh,
        contentEn,
        contentZh,
      },
      create: {
        slug,
        titleEn,
        titleZh,
        contentEn,
        contentZh,
      },
    });

    revalidatePath("/dashboard/docs");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getProvidersAndModels() {
  try {
    const prisma = await ensureAdmin();
    const providers = await prisma.provider.findMany({
      include: {
        models: {
          orderBy: { sortOrder: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });
    return { success: true, providers: JSON.parse(JSON.stringify(providers)) };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function addUserSubscription(
  userId: string,
  data: {
    providerId?: string;
    providerModelId?: string;
    tokenLimit?: number | null;
    price: number;
    startDate: Date;
    endDate: Date;
  }
) {
  try {
    const prisma = await ensureAdmin();

    await prisma.userSubscription.create({
      data: {
        userId,
        providerId: data.providerId || null,
        providerModelId: data.providerModelId || null,
        tokenLimit: data.tokenLimit === undefined ? null : data.tokenLimit,
        price: data.price,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true
      }
    });

    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteUserSubscription(userId: string, subscriptionId: string) {
  try {
    const prisma = await ensureAdmin();

    await prisma.userSubscription.delete({
      where: { id: subscriptionId }
    });

    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function toggleUserSubscription(userId: string, subscriptionId: string, isActive: boolean) {
  try {
    const prisma = await ensureAdmin();

    await prisma.userSubscription.update({
      where: { id: subscriptionId },
      data: { isActive }
    });

    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function addSubscriptionPlan(
  providerId: string,
  data: {
    nameEn: string;
    nameZh: string;
    descriptionEn?: string;
    descriptionZh?: string;
    price: number;
    durationDays: number;
    providerModelId?: string;
    tokenLimit?: number | null;
  }
) {
  try {
    const prisma = await ensureAdmin();

    await prisma.subscriptionPlan.create({
      data: {
        providerId,
        nameEn: data.nameEn,
        nameZh: data.nameZh,
        descriptionEn: data.descriptionEn || null,
        descriptionZh: data.descriptionZh || null,
        price: data.price,
        durationDays: data.durationDays,
        providerModelId: data.providerModelId || null,
        tokenLimit: data.tokenLimit === undefined ? null : data.tokenLimit,
        isActive: true
      }
    });

    revalidatePath("/dashboard/admin/providers");
    revalidatePath(`/dashboard/admin/providers/${providerId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteSubscriptionPlan(providerId: string, planId: string) {
  try {
    const prisma = await ensureAdmin();

    await prisma.subscriptionPlan.delete({
      where: { id: planId }
    });

    revalidatePath("/dashboard/admin/providers");
    revalidatePath(`/dashboard/admin/providers/${providerId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function toggleSubscriptionPlan(providerId: string, planId: string, isActive: boolean) {
  try {
    const prisma = await ensureAdmin();

    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive }
    });

    revalidatePath("/dashboard/admin/providers");
    revalidatePath(`/dashboard/admin/providers/${providerId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}


