import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";

export default async function AdminUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const prisma = getPrisma();
  
  // Auth Check
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (currentUser?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      usageLogs: {
        orderBy: { createdAt: "desc" },
        take: 100
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 100
      }
    }
  });

  if (!user) {
    return <div className="p-8 text-red-500">User not found</div>;
  }

  // Calculate some stats locally
  const totalTokens = user.usageLogs.reduce((acc, log) => acc + log.tokens, 0);
  const totalCost = user.usageLogs.reduce((acc, log) => acc + log.cost, 0);

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div>
        <Link href="/dashboard/admin" className="text-sm text-brand-primary hover:underline mb-4 inline-block">
          &larr; Back to Admin Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">
          User Profiler: {user.name || user.email}
        </h1>
        <div className="flex gap-4 items-center">
           <span className="text-text-muted">{user.email}</span>
           <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300' : 'bg-brand-primary/10 text-brand-primary'}`}>
             {user.role}
           </span>
           {user.isBanned && (
             <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
               BANNED
             </span>
           )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm">
          <p className="text-sm text-text-muted mb-1 font-medium">Current Balance</p>
          <p className="text-3xl font-bold text-brand-primary">${user.balance.toFixed(4)}</p>
        </div>
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm">
          <p className="text-sm text-text-muted mb-1 font-medium">Total Lifetime Spend</p>
          <p className="text-3xl font-bold text-text-main">${totalCost.toFixed(4)}</p>
        </div>
        <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm">
          <p className="text-sm text-text-muted mb-1 font-medium">Total Lifetime Tokens</p>
          <p className="text-3xl font-bold text-text-main">{totalTokens.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* Transactions Table */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-lg font-bold text-text-main">Transaction History (Top 100)</h2>
          </div>
          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-bg-surface-hover z-10">
                <tr className="text-text-muted text-sm border-b border-border-subtle">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status / Provider</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {user.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface-hover/50">
                    <td className="px-6 py-4 text-text-muted">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-text-main font-medium">{tx.type}</td>
                    <td className={`px-6 py-4 font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                        {tx.status} <br/>
                        <span className="text-xs opacity-70">{tx.providerId}</span>
                    </td>
                  </tr>
                ))}
                {user.transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-text-muted">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usage Logs Table */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-lg font-bold text-text-main">Usage Logs (Top 100)</h2>
          </div>
          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-bg-surface-hover z-10">
                <tr className="text-text-muted text-sm border-b border-border-subtle">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Model</th>
                  <th className="px-6 py-4 font-medium">Tokens</th>
                  <th className="px-6 py-4 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {user.usageLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface-hover/50">
                    <td className="px-6 py-4 text-text-muted">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-text-main font-medium">{log.model}</td>
                    <td className="px-6 py-4 text-text-main">{log.tokens.toLocaleString()}</td>
                    <td className="px-6 py-4 text-red-500 font-medium">-${log.cost.toFixed(6)}</td>
                  </tr>
                ))}
                {user.usageLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-text-muted">No usage logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
