import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { dictionaries } from "@/lib/i18n";
import { cookies } from "next/headers";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) redirect("/");

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const t = dictionaries[locale];

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-main">
          {t.settingsPage.title}
        </h1>
        <p className="mt-2 text-text-muted">
          {t.settingsPage.subtitle}
        </p>
      </header>

      <SettingsClient initialUser={JSON.parse(JSON.stringify(user))} />
    </>
  );
}
