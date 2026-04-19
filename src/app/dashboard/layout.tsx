import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOutAction } from "../actions";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import type { ReactNode } from "react";
import { getPrisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  let isAdmin = false;
  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    isAdmin = dbUser?.role === "ADMIN";

    // If user doesn't exist by id, try by email (covers first-login edge case)
    if (!dbUser && session.user.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      });
      isAdmin = byEmail?.role === "ADMIN";
    }
  } catch (err) {
    console.error("[dashboard/layout] DB lookup failed:", err);
    // Continue with isAdmin=false; page will still render
  }

  return (
    <DashboardLayoutClient user={session.user} signOutAction={signOutAction} isAdmin={isAdmin}>
      {children}
    </DashboardLayoutClient>
  );
}
