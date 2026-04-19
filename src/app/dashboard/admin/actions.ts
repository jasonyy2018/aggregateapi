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
