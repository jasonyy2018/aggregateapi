"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import type { ReactNode } from "react";

export function DashboardLayoutClient({
  children,
  user,
  signOutAction,
  isAdmin = false,
}: {
  children: ReactNode;
  user: { name?: string | null; email?: string | null; image?: string | null };
  signOutAction: () => void;
  isAdmin?: boolean;
}) {
  const { t, locale, setLocale } = useLang();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const navItems: { label: string; href: string }[] = [
    { label: t.dashboard.overview, href: "/dashboard" },
    { label: t.dashboard.models, href: "/dashboard/models" },
    { label: t.dashboard.apiKeys, href: "/dashboard/keys" },
    { label: t.dashboard.billing, href: "/dashboard/billing" },
    { label: t.dashboard.settings, href: "/dashboard/settings" },
  ];

  if (isAdmin) {
    navItems.push({ label: t.dashboard.admin, href: "/dashboard/admin" });
    navItems.push({ label: t.dashboard.adminProviders, href: "/dashboard/admin/providers" });
    navItems.push({ label: t.dashboard.adminPayments, href: "/dashboard/admin/payments" });
  }

  return (
    <div className="flex h-screen bg-bg-main text-text-main font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-bg-surface border-r border-border-subtle p-8 hidden md:flex flex-col shrink-0 z-10 transition-colors">
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/"
            className="text-2xl font-bold text-brand-primary tracking-tight hover:opacity-80 transition-opacity flex items-center gap-3"
          >
            <img src="/logo.jpg" alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
            {t.nav.brand}
          </Link>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`block rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                  active
                    ? "bg-brand-primary text-brand-primary-text"
                    : "text-text-muted hover:text-text-main hover:bg-bg-surface-hover"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile + Tools */}
        <div className="mt-auto pt-6 border-t border-border-subtle flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded bg-bg-surface-hover hover:bg-border-subtle transition-colors text-sm"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            <button
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
              className="px-3 py-1.5 rounded bg-bg-surface-hover hover:bg-border-subtle transition-colors text-sm font-medium"
            >
              {locale === "en" ? "中文" : "EN"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || "Avatar"}
                className="w-10 h-10 rounded-full ring-2 ring-border-subtle"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-sm">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {user.name || "User"}
              </span>
              <span className="text-xs text-text-muted truncate">
                {user.email}
              </span>
            </div>
          </div>

          <form action={signOutAction} className="w-full">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors group"
            >
              <span className="text-lg group-hover:scale-110 transition-transform">󰍃</span>
              {t.dashboard.signOut}
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 md:p-16 overflow-y-auto">{children}</main>
    </div>
  );
}
