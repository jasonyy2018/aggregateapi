"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";

export function LandingClient({
  isLoggedIn,
  userEmail,
  plans = [],
}: {
  isLoggedIn: boolean;
  userEmail?: string | null;
  plans?: any[];
}) {
  const { t, locale, setLocale } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [billingFilter, setBillingFilter] = useState<string>("all");

  const planList = Array.isArray(plans) ? plans : [];

  // Detect which duration categories actually exist in backend plans
  const hasWeekly = planList.some((p) => p.durationDays < 30);
  const hasMonthly = planList.some((p) => p.durationDays >= 30 && p.durationDays <= 31);
  const hasQuarterly = planList.some((p) => p.durationDays > 31 && p.durationDays <= 120);
  const hasYearly = planList.some((p) => p.durationDays > 120);

  // Count distinct duration categories
  const categoriesCount = [hasWeekly, hasMonthly, hasQuarterly, hasYearly].filter(Boolean).length;

  // Filter plans strictly from backend data
  const filteredPlans = planList.filter((plan) => {
    if (billingFilter === "all") return true;
    if (billingFilter === "weekly") return plan.durationDays < 30;
    if (billingFilter === "monthly") return plan.durationDays >= 30 && plan.durationDays <= 31;
    if (billingFilter === "quarterly") return plan.durationDays > 31 && plan.durationDays <= 120;
    if (billingFilter === "yearly") return plan.durationDays > 120;
    return true;
  });


  return (
    <div className="min-h-screen font-sans selection:bg-brand-primary/30 selection:text-white">
      {/* JSON-LD Structured Data for Product / SaaS SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "AggregatAPI",
            "description": locale === "zh" 
              ? "自动将请求路由最优 AI 模型。内置计费、密钥管理和分析功能。" 
              : "Route your request to the best AI models automatically. Built-in billing, keys management, and analytics.",
            "image": "https://aapi.togomol.com/logo.jpg",
            "brand": {
              "@type": "Brand",
              "name": "AggregatAPI"
            },
            ...(planList.length > 0 ? {
              "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "USD",
                "lowPrice": String(Math.min(...planList.map((p) => p.price))),
                "highPrice": String(Math.max(...planList.map((p) => p.price))),
                "offerCount": String(planList.length)
              }
            } : {})
          })
        }}
      />

      {/* Background Neon Streaks */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[60%] h-2 bg-[#818CF8] opacity-50 blur-2xl -rotate-6" />
        <div className="absolute top-[60%] right-[-10%] w-[50%] h-2 bg-[#C084FC] opacity-40 blur-[50px] rotate-12" />
        <div className="absolute bottom-[10%] left-[20%] w-[40%] h-1 bg-[#2DD4BF] opacity-50 blur-[30px] rotate-10" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="relative z-20 flex flex-wrap items-center justify-between px-8 md:px-16 py-6 gap-4">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold tracking-tight text-brand-primary">
          <img src="/logo.jpg" alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          {t.nav.brand}
        </Link>

        <div className="flex items-center gap-4 ml-auto">
          {/* Controls */}
          <div className="flex items-center gap-2 border-r border-border-subtle pr-4">
            <button
              onClick={toggleTheme}
              className="px-2 py-1 rounded text-sm hover:bg-bg-surface-hover transition-colors text-text-muted"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            <button
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
              className="px-2 py-1 rounded text-sm hover:bg-bg-surface-hover transition-colors text-text-muted"
            >
              {locale === "en" ? "中" : "EN"}
            </button>
          </div>

          {isLoggedIn ? (
            <>
              <span className="text-sm text-text-muted hidden sm:inline">
                {userEmail}
              </span>
              <Link
                href="/dashboard"
                className="h-10 px-5 rounded-lg bg-brand-primary text-brand-primary-text font-semibold text-sm flex items-center justify-center transition-transform hover:scale-105"
              >
                {t.nav.dashboard}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="h-10 px-5 rounded-lg border border-border-subtle text-text-main text-sm font-medium flex items-center justify-center transition-colors hover:bg-bg-surface cursor-pointer bg-transparent"
            >
              {t.nav.signIn}
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 pb-20">
        <div className="flex-1" />

        <div className="flex flex-col items-center justify-center text-center space-y-10 z-10 w-full max-w-4xl mx-auto">
          <div className="inline-flex items-center rounded-2xl border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-brand-secondary shadow-sm">
            {t.landing.badge}
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tight text-text-main leading-[1.1]">
            {t.landing.title1}
            <br />
            {t.landing.title2}
          </h1>

          <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed">
            {t.landing.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center h-14 px-8 rounded-lg bg-brand-primary text-brand-primary-text font-bold text-lg transition-transform hover:scale-105"
              >
                {t.landing.ctaLoggedIn}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-14 px-8 rounded-lg bg-brand-primary text-brand-primary-text font-bold text-lg transition-transform hover:scale-105 cursor-pointer w-full text-center"
              >
                {t.landing.cta}
              </Link>
            )}
            <Link
              href={planList.length > 0 ? "#pricing" : "#features"}
              className="inline-flex items-center justify-center h-14 px-8 rounded-lg border border-border-subtle text-text-main bg-bg-surface text-lg transition-colors hover:bg-bg-surface-hover font-medium"
            >
              {planList.length > 0
                ? (locale === "zh" ? "套餐价格" : "Pricing Plans")
                : (locale === "zh" ? "功能特性" : "Features")}
            </Link>
          </div>
        </div>

        <div className="flex-1 min-h-[100px]" />

        {/* Features */}
        <div
          id="features"
          className="grid grid-cols-1 md:grid-cols-3 gap-8 z-10 w-full max-w-6xl mx-auto mb-28"
        >
          {t.landing.features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border-subtle bg-bg-surface shadow-sm p-10 flex flex-col items-start hover:-translate-y-1 transition-all duration-300 hover:border-brand-primary"
            >
              <span className="text-3xl mb-4">{f.icon}</span>
              <h3 className="text-2xl font-bold text-text-main mb-3">
                {f.title}
              </h3>
              <p className="text-text-muted text-base leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Pricing Section (首页套餐计划 - 仅在后台创建套餐后展示) */}
        {planList.length > 0 && (
          <div id="pricing" className="z-10 w-full max-w-6xl mx-auto py-16 px-4 flex flex-col items-center">
            <div className="text-center max-w-3xl mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary mb-3">
                ⚡ {locale === "zh" ? "特惠专区" : "Special Offers"}
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold text-text-main tracking-tight mb-4 bg-gradient-to-r from-text-main via-brand-primary to-brand-secondary bg-clip-text text-transparent">
                {locale === "zh" ? "精选套餐 极速接入" : "Flexible Subscription Plans"}
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed">
                {locale === "zh"
                  ? "选择适合您的包月或包年套餐，享受极具性价比的 API 优质路由，无感支付与按量自动扣减。"
                  : "Select a package tailormade for your projects. Get premium routing, high concurrency, and predictable spending."}
              </p>
            </div>

            {/* Duration Filter Switcher (仅当存在多个周期时展示) */}
            {categoriesCount > 1 && (
              <div className="flex items-center justify-center mb-12">
                <div className="relative flex p-1 bg-bg-surface border border-border-subtle rounded-2xl shadow-inner gap-1">
                  <button
                    onClick={() => setBillingFilter("all")}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
                      billingFilter === "all"
                        ? "bg-brand-primary text-brand-primary-text shadow-md scale-105"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    {locale === "zh" ? "全部套餐" : "All Plans"}
                  </button>
                  {hasWeekly && (
                    <button
                      onClick={() => setBillingFilter("weekly")}
                      className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
                        billingFilter === "weekly"
                          ? "bg-brand-primary text-brand-primary-text shadow-md scale-105"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      {locale === "zh" ? "周卡" : "Weekly"}
                    </button>
                  )}
                  {hasMonthly && (
                    <button
                      onClick={() => setBillingFilter("monthly")}
                      className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
                        billingFilter === "monthly"
                          ? "bg-brand-primary text-brand-primary-text shadow-md scale-105"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      {locale === "zh" ? "包月计划" : "Monthly"}
                    </button>
                  )}
                  {hasQuarterly && (
                    <button
                      onClick={() => setBillingFilter("quarterly")}
                      className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
                        billingFilter === "quarterly"
                          ? "bg-brand-primary text-brand-primary-text shadow-md scale-105"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      {locale === "zh" ? "包季优选" : "Quarterly"}
                    </button>
                  )}
                  {hasYearly && (
                    <button
                      onClick={() => setBillingFilter("yearly")}
                      className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 ${
                        billingFilter === "yearly"
                          ? "bg-brand-primary text-brand-primary-text shadow-md scale-105"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      {locale === "zh" ? "包年尊享" : "Yearly"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full justify-center items-stretch">
              {filteredPlans.length === 0 ? (
                <div className="col-span-full py-12 text-center text-text-muted bg-bg-surface/50 border border-border-subtle rounded-2xl p-8">
                  <p className="text-base font-medium">
                    {locale === "zh" ? "该周期暂无可订购套餐" : "No packages found for this billing cycle."}
                  </p>
                  <button
                    onClick={() => setBillingFilter("all")}
                    className="mt-3 text-sm text-brand-primary hover:underline font-semibold"
                  >
                    {locale === "zh" ? "查看全部套餐" : "View all plans"}
                  </button>
                </div>
              ) : (
                filteredPlans.map((plan, idx) => {
                  const providerName = plan.provider?.name || plan.providerId;
                  const providerLogo = plan.provider?.logoUrl;
                  const coverage = plan.providerModel
                    ? `${providerName} / ${plan.providerModel.displayName || plan.providerModel.modelId}`
                    : `${providerName} (${locale === "zh" ? "全部模型通用" : "All Models"})`;

                  const quotaLimit =
                    plan.tokenLimit === null || plan.tokenLimit === undefined
                      ? (locale === "zh" ? "无限额度" : "Unlimited Tokens")
                      : `${(plan.tokenLimit >= 1000000 ? `${(plan.tokenLimit / 1000000).toLocaleString()}M` : plan.tokenLimit.toLocaleString())} Tokens`;

                  const isUnlimited = plan.tokenLimit === null || plan.tokenLimit === undefined;
                  const isYearly = plan.durationDays >= 360;
                  const durationBadge =
                    plan.durationDays === 7
                      ? (locale === "zh" ? "周卡" : "Weekly")
                      : plan.durationDays === 30
                      ? (locale === "zh" ? "包月" : "Monthly")
                      : plan.durationDays === 90
                      ? (locale === "zh" ? "包季" : "Quarterly")
                      : plan.durationDays >= 360
                      ? (locale === "zh" ? "包年" : "Yearly")
                      : `${plan.durationDays} ${locale === "zh" ? "天" : "days"}`;

                  // Highlight card if unlimited, yearly, or marked popular
                  const isPopular = plan.isPopular || isUnlimited || (filteredPlans.length >= 3 && idx === 1);

                  const targetBillingUrl = `/dashboard/billing?planId=${plan.id}`;
                  const actionHref = isLoggedIn
                    ? targetBillingUrl
                    : `/login?callbackUrl=${encodeURIComponent(targetBillingUrl)}`;

                  return (
                    <div
                      key={plan.id || idx}
                      className={`relative rounded-3xl border p-8 flex flex-col justify-between transition-all duration-500 group ${
                        isPopular
                          ? "border-brand-primary/60 bg-bg-surface/90 shadow-2xl scale-[1.02] md:scale-[1.04] z-10 hover:-translate-y-1.5"
                          : "border-border-subtle bg-bg-surface/50 backdrop-blur-md shadow-lg hover:border-brand-secondary/60 hover:-translate-y-1"
                      }`}
                    >
                      {/* Neon Glow backdrops for Featured Card */}
                      {isPopular && (
                        <div className="absolute -inset-px bg-gradient-to-r from-brand-primary to-brand-secondary rounded-3xl blur-[8px] opacity-20 group-hover:opacity-40 transition-opacity -z-10" />
                      )}

                      {/* Badges */}
                      <div className="absolute top-5 right-5 flex gap-2 items-center">
                        {isPopular && (
                          <span className="bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/20 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                            {locale === "zh" ? "热门推荐" : "Popular"}
                          </span>
                        )}
                        <span className="bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {durationBadge}
                        </span>
                      </div>

                      <div>
                        {/* Header */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2.5 mb-3">
                            {providerLogo ? (
                              <img src={providerLogo} alt={providerName} className="w-8 h-8 object-contain rounded-lg p-0.5 bg-bg-main border border-border-subtle" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                                {isUnlimited ? "∞" : "⚡"}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                              {providerName}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold text-text-main group-hover:text-brand-primary transition-colors">
                            {locale === "zh" ? plan.nameZh : plan.nameEn}
                          </h3>
                          <p className="text-xs text-text-muted mt-2 leading-relaxed min-h-[38px]">
                            {locale === "zh"
                              ? (plan.descriptionZh || `适用于 ${providerName} 的高性价比 API 订购套餐。`)
                              : (plan.descriptionEn || `Tailored API subscription package for ${providerName}.`)}
                          </p>
                        </div>

                        {/* Pricing Display */}
                        <div className="flex flex-col mb-6 border-b border-border-subtle/50 pb-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs text-text-muted font-bold mr-1">$</span>
                            <span className="text-5xl font-extrabold text-text-main font-mono tracking-tight">
                              {plan.price.toFixed(2)}
                            </span>
                            <span className="text-xs text-text-muted font-medium ml-1">
                              / {plan.durationDays} {locale === "zh" ? "天" : "days"}
                            </span>
                          </div>
                          {plan.durationDays >= 60 && (
                            <span className="text-[11px] text-brand-primary font-semibold mt-1">
                              {locale === "zh"
                                ? `约 $${(plan.price / (plan.durationDays / 30)).toFixed(2)} / 月`
                                : `≈ $${(plan.price / (plan.durationDays / 30)).toFixed(2)} / mo`}
                            </span>
                          )}
                        </div>

                        {/* Specifications List */}
                        <ul className="space-y-3.5 mb-8">
                          <li className="flex items-start gap-3 text-sm text-text-muted">
                            <span className="text-brand-primary font-bold shrink-0 mt-0.5">✓</span>
                            <div>
                              <span className="block text-[11px] text-text-muted/70 uppercase font-semibold">
                                {locale === "zh" ? "支持范围" : "Model Coverage"}
                              </span>
                              <span className="text-text-main font-medium text-xs md:text-sm">{coverage}</span>
                            </div>
                          </li>
                          <li className="flex items-start gap-3 text-sm text-text-muted">
                            <span className="text-brand-primary font-bold shrink-0 mt-0.5">✓</span>
                            <div>
                              <span className="block text-[11px] text-text-muted/70 uppercase font-semibold">
                                {locale === "zh" ? "Token 额度" : "Token Quota"}
                              </span>
                              <span className="text-text-main font-extrabold text-xs md:text-sm tracking-wide">
                                {quotaLimit}
                              </span>
                            </div>
                          </li>
                          <li className="flex items-start gap-3 text-sm text-text-muted">
                            <span className="text-brand-primary font-bold shrink-0 mt-0.5">✓</span>
                            <div>
                              <span className="block text-[11px] text-text-muted/70 uppercase font-semibold">
                                {locale === "zh" ? "通道线路" : "Routing Route"}
                              </span>
                              <span className="text-text-main font-medium text-xs">
                                {locale === "zh" ? "高优先级独享并发通道，秒级低延迟" : "VIP high concurrency line with ultra-low latency"}
                              </span>
                            </div>
                          </li>
                          <li className="flex items-start gap-3 text-sm text-text-muted">
                            <span className="text-brand-primary font-bold shrink-0 mt-0.5">✓</span>
                            <div>
                              <span className="block text-[11px] text-text-muted/70 uppercase font-semibold">
                                {locale === "zh" ? "自动续接" : "Auto Fallback"}
                              </span>
                              <span className="text-text-main font-medium text-xs">
                                {locale === "zh" ? "套餐用尽自动切换至余额按量计费，业务不中断" : "Auto fallback to standard rates on quota expiry"}
                              </span>
                            </div>
                          </li>
                        </ul>
                      </div>

                      {/* Actions */}
                      <Link
                        href={actionHref}
                        className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-md ${
                          isPopular
                            ? "bg-brand-primary hover:bg-brand-primary/90 text-brand-primary-text hover:shadow-brand-primary/20 hover:shadow-lg scale-[1.01]"
                            : "bg-bg-surface-hover hover:bg-brand-primary hover:text-brand-primary-text text-text-main border border-border-subtle"
                        }`}
                      >
                        {isLoggedIn
                          ? (locale === "zh" ? "立即订阅" : "Subscribe Now")
                          : (locale === "zh" ? "登录并订阅" : "Sign in to Subscribe")}
                      </Link>
                    </div>
                  );
                })
              )}
            </div>

            {/* Mini Trust Badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-16 pt-8 border-t border-border-subtle/50 w-full max-w-4xl text-center">
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">⚡</span>
                <span className="text-xs font-bold text-text-main">{locale === "zh" ? "极速响应" : "Instant Activation"}</span>
                <span className="text-[10px] text-text-muted">{locale === "zh" ? "余额即时开通" : "Instant setup with balance"}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">🛡️</span>
                <span className="text-xs font-bold text-text-main">{locale === "zh" ? "安全保障" : "High Availability"}</span>
                <span className="text-[10px] text-text-muted">{locale === "zh" ? "高并发容灾" : "Failover & backup paths"}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">🔄</span>
                <span className="text-xs font-bold text-text-main">{locale === "zh" ? "自由灵活" : "Flexible Duration"}</span>
                <span className="text-[10px] text-text-muted">{locale === "zh" ? "随时叠加续费" : "Stackable subscriptions"}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">💰</span>
                <span className="text-xs font-bold text-text-main">{locale === "zh" ? "按需消费" : "Smart Billing"}</span>
                <span className="text-[10px] text-text-muted">{locale === "zh" ? "超出部分自动按额扣减" : "Auto fallback to standard rates"}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle py-8 px-8 flex flex-col items-center gap-3 text-center text-sm text-text-muted">
        <div>{t.landing.footer}</div>
        <Link href="/admin/login" className="text-xs opacity-50 hover:opacity-100 hover:text-brand-primary transition-all">
          Admin Portal
        </Link>
      </footer>
    </div>
  );
}
