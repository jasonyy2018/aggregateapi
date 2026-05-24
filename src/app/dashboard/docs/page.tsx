import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { DocsClient } from "./docs-client";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const prisma = getPrisma();
  let userKeys: string[] = [];
  let discountRate = 1.0;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { discountRate: true },
    });
    if (user) {
      discountRate = user.discountRate;
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { key: true },
    });
    userKeys = apiKeys.map((k) => k.key);
  } catch (err) {
    console.error("[DocsPage] DB lookup failed:", err);
  }

  return (
    <DocsClient
      userKeys={userKeys}
      discountRate={discountRate}
    />
  );
}
