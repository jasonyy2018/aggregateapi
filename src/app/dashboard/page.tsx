import { auth } from "@/auth";
import { DashboardOverviewClient } from "@/components/dashboard-overview-client";

export default async function DashboardPage() {
  const session = await auth();

  return <DashboardOverviewClient userName={session?.user?.name} />;
}
