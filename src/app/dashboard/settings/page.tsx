"use client";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";

export default function SettingsPage() {
  const { t, locale, setLocale } = useLang();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t.settingsPage.title}
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {t.settingsPage.subtitle}
        </p>
      </header>

      <div className="max-w-2xl space-y-8">
        {/* Profile Section */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-2">{t.settingsPage.profile}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t.settingsPage.profileDesc}
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                {t.settingsPage.name}
              </label>
              <input
                type="text"
                disabled
                value="Dev User"
                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-main)] opacity-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                {t.settingsPage.email}
              </label>
              <input
                type="email"
                disabled
                value="dev@example.com"
                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-main)] opacity-50 cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-6">{t.settingsPage.preferences}</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{t.settingsPage.language}</div>
                <div className="text-sm text-[var(--text-muted)]">
                  {locale === "en" ? "English" : "中文"}
                </div>
              </div>
              <div className="flex bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg p-1">
                <button
                  onClick={() => setLocale("en")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    locale === "en"
                      ? "bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLocale("zh")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    locale === "zh"
                      ? "bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  中文
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{t.settingsPage.theme}</div>
                <div className="text-sm text-[var(--text-muted)]">
                  {theme === "dark" ? t.settingsPage.dark : t.settingsPage.light}
                </div>
              </div>
              <div className="flex bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg p-1">
                <button
                  onClick={() => theme === "dark" && toggleTheme()}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    theme === "light"
                      ? "bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {t.settingsPage.light}
                </button>
                <button
                  onClick={() => theme === "light" && toggleTheme()}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    theme === "dark"
                      ? "bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {t.settingsPage.dark}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="border border-red-500/20 rounded-2xl p-8 bg-red-500/5">
          <h2 className="text-xl font-bold text-red-500 mb-2">
            {t.settingsPage.dangerZone}
          </h2>
          <p className="text-sm text-red-500/80 mb-6">
            {t.settingsPage.dangerDesc}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm max-w-sm text-[var(--text-muted)]">
              {t.settingsPage.deleteWarn}
            </p>
            <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors">
              {t.settingsPage.deleteAccount}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
