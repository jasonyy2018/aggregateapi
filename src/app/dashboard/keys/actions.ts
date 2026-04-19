"use server";

import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

export async function createApiKey(name: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const prisma = getPrisma();
    
    // Generate a random key: sk-aggr- + 32 bytes of hex
    const key = `sk-aggr-${randomBytes(24).toString("hex")}`;

    await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        key: key,
        name: name || "Default Key",
        isActive: true,
      },
    });

    revalidatePath("/dashboard/keys");
    return { success: true, key }; // Returning the full key only once upon creation
  } catch (error: any) {
    console.error("[createApiKey] Error:", error);
    return { error: error.message };
  }
}

export async function toggleApiKeyStatus(keyId: string, isActive: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const prisma = getPrisma();
    
    // Verify ownership
    const existing = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existing || existing.userId !== session.user.id) {
      throw new Error("Key not found or unauthorized");
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive },
    });

    revalidatePath("/dashboard/keys");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteApiKey(keyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const prisma = getPrisma();

    // Verify ownership
    const existing = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existing || existing.userId !== session.user.id) {
      throw new Error("Key not found or unauthorized");
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    revalidatePath("/dashboard/keys");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
