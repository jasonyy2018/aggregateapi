"use client";

import { useLang } from "@/lib/lang-context";
import { useState, useEffect } from "react";
import PaypalCheckout from "@/components/payment/paypal-checkout";
import AlipayCheckout from "@/components/payment/alipay-checkout";
import { Gift, Copy, Check, Users, DollarSign, Share2, UserCheck, Coins, Download } from "lucide-react";

export function BillingClient({ 
  initialBalance, 
  history,
  referralCode,
  referralCount,
  referralEarnings
}: { 
  initialBalance: number;
  history: any[];
  referralCode: string;
  referralCount: number;
  referralEarnings: number;
}) {
  const { t, locale } = useLang();
  const [amount, setAmount] = useState<number>(20);
  const [method, setMethod] = useState<"paypal" | "alipay">(locale === "zh" ? "alipay" : "paypal");

  const [referralLink, setReferralLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReferralLink(`${window.location.origin}/?ref=${referralCode}`);
    }
  }, [referralCode]);

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const downloadBillingHistory = () => {
    if (history.length === 0) return;
    
    const isZh = locale === "zh";
    const headers = isZh 
      ? "日期,类型,金额,状态\n" 
      : "Date,Type,Amount,Status\n";
      
    const rows = history.map(tx => {
      const date = tx.date.replace(/,/g, "");
      const type = tx.type.replace(/,/g, "");
      const amount = tx.amount.replace(/,/g, "");
      const status = tx.status.replace(/,/g, "");
      return `${date},${type},${amount},${status}`;
    }).join("\n");
    
    const csvContent = "\uFEFF" + headers + rows;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aggregatapi_billing_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePaymentSuccess = () => {
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
          <div className="text-5xl font-bold mb-8">${initialBalance.toFixed(2)}</div>

          <div className="space-y-6 flex-1">
            {/* Amount Selection */}
            <div>
              <h3 className="font-medium mb-3">{t.billingPage.selectAmount}</h3>
              <div className="flex flex-wrap gap-2 items-center">
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
                
                {/* Custom Amount Input */}
                <div className="relative flex items-center ml-2 border border-border-subtle rounded-lg bg-bg-main focus-within:border-brand-primary px-3 py-1.5 w-36 transition-all">
                  <span className="text-text-muted text-sm mr-1">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAmount(isNaN(val) ? 0 : val);
                    }}
                    placeholder={locale === "zh" ? "自定义金额" : "Custom"}
                    className="w-full bg-transparent border-0 outline-none text-sm text-text-main font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{t.billingPage.history}</h2>
            {history.length > 0 && (
              <button
                onClick={downloadBillingHistory}
                className="px-3.5 py-1.5 bg-bg-main hover:bg-bg-surface-hover border border-border-subtle text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 hover:text-brand-primary"
              >
                <Download size={14} />
                <span>{locale === "zh" ? "下载账单" : "Download Invoice"}</span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {history.length === 0 ? (
              <div className="py-12 text-center text-text-muted italic">
                 {t.billingPage.noTransactions}
              </div>
            ) : (
              history.map((tx, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border-subtle last:border-0">
                  <div className="flex flex-col">
                    <span className="font-medium">
                       {tx.type === 'TOPUP' ? t.billingPage.topUpType : t.billingPage.usageType}
                    </span>
                    <span className="text-xs text-text-muted">{tx.date}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-bold font-mono ${tx.color}`}>{tx.amount}</span>
                    <span className={`text-xs ${tx.status === 'SUCCESS' ? 'text-green-500' : 'text-text-muted'}`}>
                       {tx.status === 'SUCCESS' ? t.billingPage.completed : tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Referral Card */}
      <div className="bg-bg-surface border border-border-subtle rounded-3xl p-8 md:p-10 shadow-lg relative overflow-hidden group">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-brand-primary/10 transition-colors duration-500" />
        
        <div className="relative flex flex-col md:flex-row gap-8 items-start justify-between border-b border-border-subtle pb-8 mb-8">
          <div className="max-w-2xl flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold uppercase tracking-wider w-fit">
              <Gift size={14} />
              {(t.billingPage as any).referralTitle}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-text-main tracking-tight">
              {(t.billingPage as any).referralSubtitle}
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {(t.billingPage as any).referralDesc}
            </p>
          </div>

          {/* Stats Badges */}
          <div className="flex gap-4 w-full md:w-auto self-stretch md:self-auto items-stretch md:items-center">
            {/* Stat 1: Referred Count */}
            <div className="flex-1 md:flex-initial flex items-center gap-4 bg-bg-main border border-border-subtle rounded-2xl px-6 py-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-text-muted font-medium">{(t.billingPage as any).invitedCount}</span>
                <span className="text-2xl font-bold font-mono text-text-main">{referralCount}</span>
              </div>
            </div>

            {/* Stat 2: Cumulative Earnings */}
            <div className="flex-1 md:flex-initial flex items-center gap-4 bg-bg-main border border-border-subtle rounded-2xl px-6 py-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                <DollarSign size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-text-muted font-medium">{(t.billingPage as any).totalEarnings}</span>
                <span className="text-2xl font-bold font-mono text-green-500">${referralEarnings.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Referral Link Copy */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-text-muted">{(t.billingPage as any).shareLink}</label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="w-full pl-4 pr-32 py-3 bg-bg-main border border-border-subtle rounded-xl font-mono text-sm text-text-main select-all focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(referralLink, true)}
                className="absolute right-2 px-4 py-2 bg-brand-primary text-brand-primary-text rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              >
                {copiedLink ? (
                  <>
                    <Check size={14} />
                    {(t.billingPage as any).copied}
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    {(t.billingPage as any).copyLink}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referral Code Copy */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-text-muted">{(t.billingPage as any).shareCode}</label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={referralCode}
                className="w-full pl-4 pr-32 py-3 bg-bg-main border border-border-subtle rounded-xl font-mono text-sm text-text-main select-all focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(referralCode, false)}
                className="absolute right-2 px-4 py-2 bg-bg-surface border border-border-subtle text-text-main rounded-lg text-xs font-bold hover:bg-bg-surface-hover active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              >
                {copiedCode ? (
                  <>
                    <Check size={14} className="text-green-500" />
                    {(t.billingPage as any).copied}
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    {(t.billingPage as any).copyCode}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="pt-8 border-t border-border-subtle">
          <h3 className="text-sm font-bold text-text-main mb-6 uppercase tracking-wider flex items-center gap-2">
            <Coins size={16} className="text-brand-primary" />
            {(t.billingPage as any).howItWorks}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                <Share2 size={18} />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-bold text-text-main">{(t.billingPage as any).step1Title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{(t.billingPage as any).step1Desc}</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <UserCheck size={18} />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-bold text-text-main">{(t.billingPage as any).step2Title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{(t.billingPage as any).step2Desc}</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                <Gift size={18} />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-bold text-text-main">{(t.billingPage as any).step3Title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{(t.billingPage as any).step3Desc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
