"use client";
import { useLang } from "@/lib/lang-context";
import { useState } from "react";

export default function BillingPage() {
  const { t } = useLang();
  const [amount, setAmount] = useState<number>(20);

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t.billingPage.title}
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {t.billingPage.subtitle}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Balance Card */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-medium text-[var(--text-muted)] mb-2">
            {t.billingPage.currentBalance}
          </h2>
          <div className="text-5xl font-bold mb-8">$24.50</div>

          <div className="space-y-4">
            <h3 className="font-medium">{t.billingPage.topUp}</h3>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 50, 100].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    amount === val
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                      : "border-[var(--border-subtle)] hover:border-[var(--brand-primary)]/50"
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
            <button className="w-full mt-4 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.382 6.553C16.892 4.148 15.021 2 11.516 2H4.496C4.041 2 3.649 2.316 3.565 2.763L1.015 18.847C.949 19.263 1.272 19.641 1.696 19.641h3.91l.82-5.187c.084-.45.476-.793.931-.793h1.86c3.486 0 6.002-1.637 6.643-4.717.323-1.545.143-2.613-.478-3.391z" />
              </svg>
              {t.billingPage.payWith}
            </button>
          </div>
        </div>

        {/* Transaction History preview */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-6">{t.billingPage.history}</h2>
          <div className="flex flex-col gap-4">
            {[
              {
                date: "2026-04-15",
                type: t.billingPage.topUpType,
                amount: "+$20.00",
                status: t.billingPage.completed,
                color: "text-green-500",
              },
              {
                date: "2026-04-10",
                type: t.billingPage.usageType,
                amount: "-$5.50",
                status: t.billingPage.completed,
                color: "text-[var(--text-main)]",
              },
            ].map((tx, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)] last:border-0">
                <div className="flex flex-col">
                  <span className="font-medium">{tx.type}</span>
                  <span className="text-xs text-[var(--text-muted)]">{tx.date}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`font-bold font-mono ${tx.color}`}>{tx.amount}</span>
                  <span className="text-xs text-[var(--text-muted)]">{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
