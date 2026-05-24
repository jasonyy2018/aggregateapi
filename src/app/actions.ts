"use server"

import { auth, signIn, signOut } from "@/auth"
import { AuthError } from "next-auth"
import { getPrisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function signInWithCredentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password." }
        default:
          return { error: "Something went wrong." }
      }
    }
    throw error // Must throw the redirect error
  }
}

export async function signUpWithEmail(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const refCode = formData.get("referralCode") as string; // Optional referral code
  
  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  
  const prisma = getPrisma();
  
  try {
    // 1. Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });
    if (existing) {
      return { error: "Email already registered. Please sign in instead." };
    }
    
    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 3. Resolve optional referral link
    let referredById: string | null = null;
    if (refCode && refCode.trim() !== "") {
      const inviter = await prisma.user.findUnique({
        where: { referralCode: refCode.trim() },
        select: { id: true }
      });
      if (inviter) {
        referredById = inviter.id;
      } else {
        return { error: "Invalid referral code. Please check or leave empty." };
      }
    }
    
    // 4. Create user
    const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        password: hashedPassword,
        role: "USER",
        balance: 0,
        referralCode,
        referredById,
      }
    });
    
    // 5. Automatically log in after registration
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error: any) {
    if (error.name === "RedirectError" || error.message?.includes("NEXT_REDIRECT")) {
      throw error; // Must let NextJS redirect handle it
    }
    console.error("[signUpWithEmail] Error:", error);
    return { error: error.message || "Failed to register." };
  }
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" })
}

export async function updateUserProfile(name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!name || name.trim() === "") {
    return { error: "Name cannot be empty." };
  }

  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  });

  return { success: true };
}
