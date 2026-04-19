"use server"

import { signIn, signOut } from "@/auth"
import { AuthError } from "next-auth"

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

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" })
}
