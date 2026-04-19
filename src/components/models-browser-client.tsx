"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/lang-context";

type ModelRow = {
  id: string;
  modelId: string;
  displayName: string;
  description: string | null;
  contextLength: number | null;
  inputPricePer1k: number;
  outputPricePer1k: number;
  capabilities: string[];
};

type ProviderRow = {
  providerId: string;
  providerName: string;
  providerSlug: string;
  logoUrl: string | null;
  protocol: string;
  description: string | null;
  models: ModelRow[];
};

export function ModelsBrowserClient({ providers }: { providers: ProviderRow[] }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [activeProvider, setActiveProvider] = useState<string | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers
      .filter((p) => activeProvider === "all" || p.providerId === activeProvider)
      .map((p) => ({
        ...p,
        models: p.models.filter((m) => {
          if (!q) return true;
          return (
            m.modelId.toLowerCase().includes(q) ||
            m.displayName.toLowerCase().includes(q) ||
            p.providerName.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((p) => p.models.length > 0);
  }, [providers, query, activeProvider]);

  const total = providers.reduce((sum, p) => sum + p.models.length, 0);

  const copy = async (modelId: string) => {
    try {
      await navigator.clipboard.writeText(modelId);
      setCopied(modelId);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">
          {t.modelsPage.title}
        </h1>
        <p className="text-text-muted max-w-2xl">
          {t.modelsPage.subtitle.replace("{count}", String(total))}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.modelsPage.searchPlaceholder}
          className="flex-1 min-w-[220px] px-4 py-2.5 border border-border-subtle bg-bg-surface text-text-main rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
        />
        <div className="flex gap-2 flex-wrap">
          <FilterChip active={activeProvider === "all"} onClick={() => setActiveProvider("all")}>
            {t.modelsPage.all}
          </FilterChip>
          {providers.map((p) => (
            <FilterChip
              key={p.providerId}
              active={activeProvider === p.providerId}
              onClick={() => setActiveProvider(p.providerId)}
            >
              {p.providerName}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center text-text-muted">
          {t.modelsPage.empty}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {filtered.map((p) => (
            <section key={p.providerId} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoUrl} alt={p.providerName} className="w-8 h-8 rounded-md object-contain bg-bg-surface" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                    {p.providerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <h2 className="text-lg font-semibold text-text-main">{p.providerName}</h2>
                <span className="text-xs text-text-muted">{p.models.length} {t.modelsPage.models}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {p.models.map((m) => (
                  <div
                    key={m.id}
                    className="bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm hover:border-brand-primary/50 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate">{m.displayName}</div>
                        <button
                          onClick={() => copy(m.modelId)}
                          className="mt-1 text-xs font-mono text-text-muted hover:text-brand-primary truncate block w-full text-left"
                          title={t.modelsPage.copy}
                        >
                          {copied === m.modelId ? `✓ ${t.modelsPage.copied}` : m.modelId}
                        </button>
                      </div>
                      {m.contextLength && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-bg-main border border-border-subtle text-text-muted shrink-0">
                          {formatContext(m.contextLength)}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-xs text-text-muted line-clamp-2">{m.description}</p>
                    )}
                    {m.capabilities.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {m.capabilities.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-text-muted pt-2 border-t border-border-subtle mt-auto">
                      <span>
                        {t.modelsPage.input}: <span className="font-mono text-text-main">${m.inputPricePer1k.toFixed(4)}</span>/1k
                      </span>
                      <span>
                        {t.modelsPage.output}: <span className="font-mono text-text-main">${m.outputPricePer1k.toFixed(4)}</span>/1k
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-brand-primary text-brand-primary-text"
          : "bg-bg-surface border border-border-subtle text-text-muted hover:text-text-main"
      }`}
    >
      {children}
    </button>
  );
}

function formatContext(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}
