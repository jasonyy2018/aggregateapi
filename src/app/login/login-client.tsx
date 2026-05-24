"use client";

import { useState } from "react";
import { signInWithCredentials, signUpWithEmail, signInWithGoogle } from "@/app/actions";
import { useLang } from "@/lib/lang-context";
import { Mail, Lock, User, Gift, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";

export function LoginClient({ initialReferralCode }: { initialReferralCode: string }) {
  const { locale } = useLang();
  const isZh = locale === "zh";

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const updateReferralCode = (code: string) => {
    setReferralCode(code);
    // Bind to cookie instantly, so Google OAuth registrations capture it automatically
    if (typeof document !== "undefined") {
      document.cookie = `referral_code=${encodeURIComponent(code.trim())}; max-age=${30 * 24 * 60 * 60}; path=/; secure; samesite=lax`;
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    if (activeTab === "signup") {
      formData.append("name", name);
      formData.append("referralCode", referralCode);

      const res = await signUpWithEmail(formData);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        setSuccess(isZh ? "注册成功！正在进入控制台..." : "Registration successful! Redirecting...");
      }
    } else {
      const res = await signInWithCredentials(formData);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        setSuccess(isZh ? "登录成功！正在进入控制台..." : "Login successful! Redirecting...");
      }
    }
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
      
      {/* Decorative top gradient accent */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-primary via-purple-500 to-blue-500" />
      
      {/* Tab Selectors */}
      <div className="flex bg-bg-main p-1 rounded-xl mb-8 relative z-10 border border-border-subtle">
        <button
          onClick={() => {
            setActiveTab("signin");
            setError(null);
          }}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === "signin"
              ? "bg-bg-surface text-text-main shadow-md"
              : "text-text-muted hover:text-text-main"
          }`}
        >
          {isZh ? "电子邮箱登录" : "Sign In"}
        </button>
        <button
          onClick={() => {
            setActiveTab("signup");
            setError(null);
          }}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === "signup"
              ? "bg-bg-surface text-text-main shadow-md"
              : "text-text-muted hover:text-text-main"
          }`}
        >
          {isZh ? "注册新账号" : "Sign Up"}
        </button>
      </div>

      {/* Alert Messaging */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-start gap-2.5 animate-shake">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
          <CheckCircle size={16} className="shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Standard Forms */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-5 relative z-10">
        {/* Name Input (Register Only) */}
        {activeTab === "signup" && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              {isZh ? "用户昵称" : "Your Name"}
            </label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-3.5 text-text-muted" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isZh ? "例如：张三" : "e.g. Jason"}
                className="w-full pl-12 pr-4 py-3 bg-bg-main border border-border-subtle rounded-xl text-sm focus:outline-none focus:border-brand-primary text-text-main"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Email Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {isZh ? "电子邮箱" : "Email Address"}
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-3.5 text-text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              className="w-full pl-12 pr-4 py-3 bg-bg-main border border-border-subtle rounded-xl text-sm focus:outline-none focus:border-brand-primary text-text-main"
              disabled={loading}
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {isZh ? "登录密码" : "Password"}
          </label>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-3.5 text-text-muted" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-12 pr-4 py-3 bg-bg-main border border-border-subtle rounded-xl text-sm focus:outline-none focus:border-brand-primary text-text-main"
              disabled={loading}
            />
          </div>
        </div>

        {/* Invitation Code Input */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Gift size={14} className="text-brand-primary" />
              {isZh ? "邀请码 (选填)" : "Referral Code (Optional)"}
            </label>
            {referralCode && (
              <span className="text-[10px] text-brand-primary font-bold">
                {isZh ? "✓ 邀请码已锁定" : "✓ Referral Active"}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={referralCode}
              onChange={(e) => updateReferralCode(e.target.value)}
              placeholder={isZh ? "请输入推荐人邀请码" : "e.g. REF-XXXXXX"}
              className="w-full px-4 py-3 bg-bg-main border border-border-subtle rounded-xl text-sm focus:outline-none focus:border-brand-primary text-text-main font-mono"
              disabled={loading}
            />
          </div>
        </div>

        {/* Submit Form Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 py-3.5 bg-brand-primary text-brand-primary-text rounded-xl font-bold hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-brand-primary/10 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-brand-primary-text border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{activeTab === "signin" ? (isZh ? "电子邮箱登录" : "Sign In with Email") : (isZh ? "注册并登录控制台" : "Register Account")}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Or Divider */}
      <div className="relative my-8 z-10 flex items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-border-subtle" />
        <span className="relative px-4 bg-bg-surface text-3xs font-bold text-text-muted uppercase tracking-widest">
          {isZh ? "或使用快捷第三方登录" : "Or continue with"}
        </span>
      </div>

      {/* Google OAuth Quick Login Form */}
      <form action={signInWithGoogle} className="relative z-10">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-bg-main border border-border-subtle text-text-main rounded-xl font-bold hover:bg-bg-surface hover:border-brand-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>{isZh ? "谷歌账号一键快捷登录" : "Sign In with Google"}</span>
        </button>
      </form>
    </div>
  );
}
