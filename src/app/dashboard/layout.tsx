import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOutAction } from "../actions";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <DashboardLayoutClient user={session.user} signOutAction={signOutAction}>
      {children}
    </DashboardLayoutClient>
  );
}
