"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";

export function LandingClient({
  isLoggedIn,
  userEmail,
  signInAction,
}: {
  isLoggedIn: boolean;
  userEmail?: string | null;
  signInAction: () => void;
}) {
  const { t, locale, setLocale } = useLang();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen font-sans selection:bg-brand-primary/30 selection:text-white">
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
            <form action={signInAction}>
              <button
                type="submit"
                className="h-10 px-5 rounded-lg border border-border-subtle text-text-main text-sm font-medium flex items-center gap-2 transition-colors hover:bg-bg-surface cursor-pointer bg-transparent"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                {t.nav.signIn}
              </button>
            </form>
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
              <form action={signInAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center h-14 px-8 rounded-lg bg-brand-primary text-brand-primary-text font-bold text-lg transition-transform hover:scale-105 cursor-pointer w-full"
                >
                  {t.landing.cta}
                </button>
              </form>
            )}
            <Link
              href="#features"
              className="inline-flex items-center justify-center h-14 px-8 rounded-lg border border-border-subtle text-text-main bg-bg-surface text-lg transition-colors hover:bg-bg-surface-hover font-medium"
            >
              {t.landing.learnMore}
            </Link>
          </div>
        </div>

        <div className="flex-1 min-h-[100px]" />

        {/* Features */}
        <div
          id="features"
          className="grid grid-cols-1 md:grid-cols-3 gap-8 z-10 w-full max-w-6xl mx-auto"
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
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle py-8 px-8 text-center text-sm text-text-muted">
        {t.landing.footer}
      </footer>
    </div>
  );
}
