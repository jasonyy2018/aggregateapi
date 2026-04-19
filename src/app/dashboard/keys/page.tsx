import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { KeysClient } from "./keys-client";
import { dictionaries } from "@/lib/i18n";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const t = dictionaries[locale];

  let keys: any[] = [];
  try {
    const prisma = getPrisma();
    keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[keys/page] DB error:", err);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-main">
          {t.keys.title}
        </h1>
        <p className="mt-2 text-text-muted">{t.keys.subtitle}</p>
      </header>

      <KeysClient initialKeys={JSON.parse(JSON.stringify(keys))} />

      {/* API Endpoint Documentation */}
      <div className="mt-12 bg-brand-primary/5 border border-brand-primary/10 p-8 rounded-3xl">
        <h3 className="text-lg font-bold text-text-main mb-2">
          {t.keys.endpoint}
        </h3>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          {t.keys.endpointDesc}
        </p>
        <div className="relative group">
          <code className="block p-4 rounded-xl bg-bg-main text-brand-primary font-mono text-sm border border-border-subtle shadow-inner">
            https://aapi.togomol.com/api/v1
          </code>
        </div>
      </div>
    </div>
  );
}
