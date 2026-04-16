"use client";
import { useLang } from "@/lib/lang-context";
import { useState } from "react";
import PaypalCheckout from "@/components/payment/paypal-checkout";
import AlipayCheckout from "@/components/payment/alipay-checkout";

export default function BillingPage() {
  const { t } = useLang();
  const [amount, setAmount] = useState<number>(20);
  const [method, setMethod] = useState<"paypal" | "alipay">("paypal");

  const handlePaymentSuccess = () => {
    alert("Payment successful! Balance applied.");
    // In production, trigger a mutate/refresh to reload user balance.
    window.location.reload();
  };

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t.billingPage.title}
        </h1>
        <p className="mt-2 text-text-muted">
          {t.billingPage.subtitle}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Balance Card */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm flex flex-col">
          <h2 className="text-lg font-medium text-text-muted mb-2">
            {t.billingPage.currentBalance}
          </h2>
          <div className="text-5xl font-bold mb-8">$24.50</div>

          <div className="space-y-6 flex-1">
            {/* Amount Selection */}
            <div>
              <h3 className="font-medium mb-3">{t.billingPage.selectAmount}</h3>
              <div className="flex flex-wrap gap-2">
                {[10, 20, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      amount === val
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-border-subtle hover:border-brand-primary/50"
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Toggle */}
            <div className="pt-2 border-t border-border-subtle">
              <div className="flex bg-bg-main p-1 rounded-lg">
                <button
                  onClick={() => setMethod("paypal")}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    method === "paypal" ? "bg-bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.1)] text-text-main" : "text-text-muted hover:text-text-main"
                  }`}
                >
                  {t.billingPage.paypal}
                </button>
                <button
                  onClick={() => setMethod("alipay")}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    method === "alipay" ? "bg-[#1677FF] text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]" : "text-text-muted hover:text-text-main"
                  }`}
                >
                  {t.billingPage.alipay}
                </button>
              </div>
            </div>

            {/* Dynamic Payment Gateways */}
            <div className="mt-auto">
              {method === "paypal" ? (
                <PaypalCheckout amount={amount} onSuccess={handlePaymentSuccess} />
              ) : (
                <AlipayCheckout amount={amount} />
              )}
            </div>
          </div>
        </div>

        {/* Transaction History preview */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
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
                color: "text-text-main",
              },
            ].map((tx, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-border-subtle last:border-0">
                <div className="flex flex-col">
                  <span className="font-medium">{tx.type}</span>
                  <span className="text-xs text-text-muted">{tx.date}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`font-bold font-mono ${tx.color}`}>{tx.amount}</span>
                  <span className="text-xs text-text-muted">{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
