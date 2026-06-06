import { auth } from "@/auth";
import { LandingClient } from "@/components/landing-client";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";

export default async function Home(props: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await auth();
  const searchParams = await props.searchParams;
  const ref = searchParams?.ref;

  if (ref) {
    try {
      const cookieStore = await cookies();
      cookieStore.set("referral_code", ref, {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
      console.log(`[REFERRAL] Saved referral code cookie: ${ref}`);
    } catch (err) {
      console.error("[REFERRAL] Failed to save referral cookie:", err);
    }
  }

  const prisma = getPrisma();
  const activePlans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    include: {
      provider: true,
      providerModel: true
    },
    orderBy: { price: "asc" }
  });

  return (
    <LandingClient
      isLoggedIn={!!session?.user}
      userEmail={session?.user?.email}
      plans={JSON.parse(JSON.stringify(activePlans))}
    />
  );
}
