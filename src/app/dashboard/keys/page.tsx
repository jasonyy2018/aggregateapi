"use client";
import { useLang } from "@/lib/lang-context";

export default function KeysPage() {
  const { t } = useLang();

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t.keys.title}
        </h1>
        <p className="mt-2 text-text-muted">{t.keys.subtitle}</p>
      </header>

      <div className="mb-8">
        <button className="h-10 px-4 rounded-lg bg-brand-primary text-brand-primary-text font-medium transition-transform hover:scale-105">
          + {t.keys.create}
        </button>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col gap-8">
          {/* Example Key Row */}
          <div>
            <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Production API Key</span>
                <code className="text-sm text-text-muted bg-bg-main px-2 py-1 rounded inline-block">
                  sk-aggr-••••••••••••••••••••••••••••
                </code>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-2.5 py-1 bg-green-500/10 text-green-500 rounded text-xs">
                  {t.keys.active}
                </span>
                <button className="text-sm text-text-muted hover:text-red-500 transition-colors">
                  {t.keys.revoke}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Test Project key</span>
                <code className="text-sm text-text-muted bg-bg-main px-2 py-1 rounded inline-block">
                  sk-aggr-••••••••••••••••••••••••••••
                </code>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-2.5 py-1 bg-red-500/10 text-red-500 rounded text-xs">
                  {t.keys.revoked}
                </span>
                <button className="text-sm text-text-muted hover:text-red-500 transition-colors">
                  {t.keys.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-brand-primary/10 border border-brand-primary/20 p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-brand-primary mb-2">
          {t.keys.endpoint}
        </h3>
        <p className="text-sm text-text-muted mb-4">
          {t.keys.endpointDesc}
        </p>
        <code className="block p-4 rounded bg-bg-main text-sm border border-border-subtle">
          https://api.aggregatapi.com/v1
        </code>
      </div>
    </>
  );
}
