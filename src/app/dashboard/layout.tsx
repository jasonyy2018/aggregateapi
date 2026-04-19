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

  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  });

  const isAdmin = dbUser?.role === "ADMIN";

  return (
    <DashboardLayoutClient user={session.user} signOutAction={signOutAction} isAdmin={isAdmin}>
      {children}
    </DashboardLayoutClient>
  );
}
