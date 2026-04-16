"use client";

import { useLang } from "@/lib/lang-context";

export function DashboardOverviewClient({
  userName,
}: {
  userName?: string | null;
}) {
  const { t } = useLang();

  return (
    <>
      {/* Header */}
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t.dashboard.title}
        </h1>
        <span className="text-sm text-[var(--text-muted)] hidden sm:inline">
          {t.dashboard.welcome} {userName?.split(" ")[0]}
        </span>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col gap-2 hover:border-[var(--brand-primary)]/50 transition-colors shadow-sm">
          <span className="text-sm text-[var(--text-muted)] font-medium">
            {t.dashboard.stats.balance}
          </span>
          <span className="text-4xl font-bold">$24.50</span>
          <span className="text-xs text-[var(--brand-secondary)] cursor-pointer hover:underline">
            {t.dashboard.stats.topUp}
          </span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col gap-2 hover:border-[var(--brand-primary)]/50 transition-colors shadow-sm">
          <span className="text-sm text-[var(--text-muted)] font-medium">
            {t.dashboard.stats.requests}
          </span>
          <span className="text-4xl font-bold">45,231</span>
          <span className="text-xs text-[var(--text-muted)]">
            {t.dashboard.stats.requestsSub}
          </span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col gap-2 hover:border-[var(--brand-primary)]/50 transition-colors shadow-sm">
          <span className="text-sm text-[var(--text-muted)] font-medium">
            {t.dashboard.stats.latency}
          </span>
          <span className="text-4xl font-bold text-[var(--brand-secondary)]">
            420ms
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {t.dashboard.stats.latencySub}
          </span>
        </div>
      </div>

      {/* Recent Usage Logs */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-sm">
        <h2 className="text-xl font-bold mb-6">{t.dashboard.usage.title}</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="pb-4 text-sm font-medium text-[var(--text-muted)]">
                  {t.dashboard.usage.time}
                </th>
                <th className="pb-4 text-sm font-medium text-[var(--text-muted)]">
                  {t.dashboard.usage.model}
                </th>
                <th className="pb-4 text-sm font-medium text-[var(--text-muted)]">
                  {t.dashboard.usage.tokens}
                </th>
                <th className="pb-4 text-sm font-medium text-[var(--text-muted)] text-right">
                  {t.dashboard.usage.cost}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {[
                {
                  time: "2 mins ago",
                  model: "openai/gpt-4o",
                  tokens: "1,240",
                  cost: "-$0.0024",
                },
                {
                  time: "15 mins ago",
                  model: "meta-llama/Llama-3-8b",
                  tokens: "521",
                  cost: "-$0.0002",
                },
                {
                  time: "1 hour ago",
                  model: "openai/gpt-4o",
                  tokens: "2,100",
                  cost: "-$0.0042",
                },
                {
                  time: "3 hours ago",
                  model: "anthropic/claude-3.5-sonnet",
                  tokens: "3,500",
                  cost: "-$0.0105",
                },
                {
                  time: "5 hours ago",
                  model: "mistralai/Mixtral-8x7B",
                  tokens: "890",
                  cost: "-$0.0004",
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <td className="py-4 text-sm text-[var(--text-muted)]">
                    {row.time}
                  </td>
                  <td className="py-4">
                    <span className="px-2.5 py-1 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-md text-xs font-mono">
                      {row.model}
                    </span>
                  </td>
                  <td className="py-4 text-sm">{row.tokens}</td>
                  <td className="py-4 text-sm text-[var(--brand-secondary)] text-right font-mono">
                    {row.cost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
