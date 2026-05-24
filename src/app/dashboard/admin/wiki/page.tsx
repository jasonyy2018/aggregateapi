import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { WikiEditorClient } from "./wiki-editor-client";

export const dynamic = "force-dynamic";

export default async function AdminWikiPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const prisma = getPrisma();
  
  // Verify administrator role
  let isAdmin = false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });
    isAdmin = user?.role === "ADMIN";

    // Fallback search by email
    if (!user && session.user.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true }
      });
      isAdmin = byEmail?.role === "ADMIN";
    }
  } catch (err) {
    console.error("[AdminWikiPage] Auth verification error:", err);
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Load all seeded wiki sections
  const sections = await prisma.wikiSection.findMany({
    orderBy: { slug: "asc" }
  });

  return (
    <WikiEditorClient
      initialSections={sections.map((s) => ({
        slug: s.slug,
        titleEn: s.titleEn,
        titleZh: s.titleZh,
        contentEn: s.contentEn,
        contentZh: s.contentZh,
      }))}
    />
  );
}
