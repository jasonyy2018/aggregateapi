"use client";

import { useState, useTransition } from "react";
import { useLang } from "@/lib/lang-context";
import { updatePaymentSettings } from "@/app/dashboard/admin/providers/actions";

type PaymentSettingsView = {
  paypalClientId?: string | null;
  alipayAppId?: string | null;
  alipayPublicKey?: string | null;
};

export function AdminPaymentsClient({ settings }: { settings: PaymentSettingsView }) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [form, setForm] = useState({
    paypalMode: (settings as any).paypalMode ?? "sandbox",
    paypalClientId: settings.paypalClientId ?? "",
    paypalSecret: "",
    alipayAppId: settings.alipayAppId ?? "",
    alipayPublicKey: settings.alipayPublicKey ?? "",
    alipayPrivateKey: "",
  });

  const showFlash = (type: "ok" | "err", msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3000);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await updatePaymentSettings({
        paypalMode: form.paypalMode,
        paypalClientId: form.paypalClientId,
        paypalSecret: form.paypalSecret || undefined,
        alipayAppId: form.alipayAppId,
        alipayPublicKey: form.alipayPublicKey,
        alipayPrivateKey: form.alipayPrivateKey || undefined,
      });
      if (r?.error) showFlash("err", r.error);
      else showFlash("ok", t.providers.saved);
    });
  };

  const inputClass = "w-full px-4 py-2.5 border border-border-subtle bg-bg-surface text-text-main rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all";

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      {flash && (
        <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 ${
          flash.type === "ok" ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-red-500/10 border-red-500/20 text-red-600"
        }`}>
          {flash.msg}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-8">
        {/* PayPal Section */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
               <span className="text-blue-600 font-bold">P</span>
            </div>
            <div>
              <h3 className="font-bold text-text-main text-lg">PayPal</h3>
              <p className="text-sm text-text-muted">Configure your PayPal REST API credentials</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">{t.providers.paypalMode}</label>
              <select
                className={inputClass}
                value={form.paypalMode}
                onChange={(e) => setForm({ ...form, paypalMode: e.target.value })}
              >
                <option value="sandbox">{t.providers.paypalModeSandbox}</option>
                <option value="live">{t.providers.paypalModeLive}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">{t.providers.paypalClientId}</label>
              <input
                className={inputClass}
                value={form.paypalClientId}
                onChange={(e) => setForm({ ...form, paypalClientId: e.target.value })}
                placeholder="Aa1Bb2Cc3..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">{t.providers.paypalSecret}</label>
              <input
                type="password"
                className={inputClass}
                value={form.paypalSecret}
                onChange={(e) => setForm({ ...form, paypalSecret: e.target.value })}
                placeholder={t.providers.leaveEmptyToKeep}
              />
            </div>
          </div>
        </div>

        {/* Alipay Section */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-400/10 flex items-center justify-center">
               <span className="text-blue-500 font-bold">支</span>
            </div>
            <div>
              <h3 className="font-bold text-text-main text-lg">Alipay (支付宝)</h3>
              <p className="text-sm text-text-muted">Configure your Alipay Open Platform credentials</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">{t.providers.alipayAppId}</label>
              <input
                className={inputClass}
                value={form.alipayAppId}
                onChange={(e) => setForm({ ...form, alipayAppId: e.target.value })}
                placeholder="2021000..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-text-main mb-2">{t.providers.alipayPublicKey}</label>
                <textarea
                  className={inputClass + " h-32 text-xs font-mono"}
                  value={form.alipayPublicKey}
                  onChange={(e) => setForm({ ...form, alipayPublicKey: e.target.value })}
                  placeholder="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-main mb-2">{t.providers.alipayPrivateKey}</label>
                <textarea
                  className={inputClass + " h-32 text-xs font-mono"}
                  value={form.alipayPrivateKey}
                  onChange={(e) => setForm({ ...form, alipayPrivateKey: e.target.value })}
                  placeholder={t.providers.leaveEmptyToKeep}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 bg-brand-primary text-brand-primary-text rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50"
          >
            {isPending ? "..." : t.providers.settingsSave}
          </button>
        </div>
      </form>
    </div>
  );
}
