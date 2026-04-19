"use client";

import { useState, useTransition } from "react";
import { useLang } from "@/lib/lang-context";
import {
  createProvider,
  updateProvider,
  deleteProvider,
  toggleProviderEnabled,
  createProviderModel,
  updateProviderModel,
  deleteProviderModel,
  toggleProviderModelEnabled,
  testProviderConnection,
  importProviderModels,
  applyMarginToProvider,
  applyMarginToModel,
  updatePlatformSettings,
} from "@/app/dashboard/admin/providers/actions";
import { computeMargin, applyMargin } from "@/lib/pricing";

// ----- Types mirroring server props -----

type ProviderProtocol = "OPENAI" | "ANTHROPIC" | "GEMINI";

type ModelView = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  description: string | null;
  contextLength: number | null;
  costInputPer1k: number;
  costOutputPer1k: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
  isEnabled: boolean;
  sortOrder: number;
  capabilities: string[];
};

type PlatformSettingsView = {
  defaultMarginPct: number;
  minMarginPct: number;
  autoApplyMargin: boolean;
};

type ProviderView = {
  id: string;
  name: string;
  slug: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKeyHint: string | null;
  hasApiKey: boolean;
  logoUrl: string | null;
  description: string | null;
  isEnabled: boolean;
  sortOrder: number;
  extraHeaders: Record<string, string> | null;
  models: ModelView[];
};

const PROTOCOL_DEFAULTS: Record<ProviderProtocol, string> = {
  OPENAI: "https://api.openai.com/v1",
  ANTHROPIC: "https://api.anthropic.com/v1",
  GEMINI: "https://generativelanguage.googleapis.com/v1beta",
};

// ---------- Main Component ----------

export function AdminProvidersClient({
  providers,
  settings,
}: {
  providers: ProviderView[];
  settings: PlatformSettingsView;
}) {
  const { t } = useLang();
  const [expandedId, setExpandedId] = useState<string | null>(providers[0]?.id ?? null);
  const [providerModal, setProviderModal] = useState<{ mode: "create" | "edit"; data?: ProviderView } | null>(null);
  const [modelModal, setModelModal] = useState<
    { providerId: string; data?: ModelView; defaults?: PlatformSettingsView } | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const flash = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const onToggleProvider = (p: ProviderView) =>
    startTransition(async () => {
      const r = await toggleProviderEnabled(p.id, !p.isEnabled);
      if (r?.error) flash("err", r.error);
    });

  const onDeleteProvider = (p: ProviderView) => {
    if (!confirm(`${t.providers.confirmDeleteProvider} ${p.name}?`)) return;
    startTransition(async () => {
      const r = await deleteProvider(p.id);
      if (r?.error) flash("err", r.error);
      else flash("ok", t.providers.deleted);
    });
  };

  const onTest = (p: ProviderView) =>
    startTransition(async () => {
      const r = await testProviderConnection(p.id);
      if (r?.error) flash("err", `${p.name}: ${r.error}`);
      else flash("ok", `${p.name}: ${r.message}`);
    });

  const onImport = (p: ProviderView) => {
    if (!confirm(t.providers.confirmImport)) return;
    startTransition(async () => {
      const r = await importProviderModels(p.id);
      if (r?.error) flash("err", `${p.name}: ${r.error}`);
      else flash("ok", `${p.name}: ${r.message}`);
    });
  };

  const onToggleModel = (m: ModelView) =>
    startTransition(async () => {
      const r = await toggleProviderModelEnabled(m.id, !m.isEnabled);
      if (r?.error) flash("err", r.error);
    });

  const onDeleteModel = (m: ModelView) => {
    if (!confirm(`${t.providers.confirmDeleteModel} ${m.modelId}?`)) return;
    startTransition(async () => {
      const r = await deleteProviderModel(m.id);
      if (r?.error) flash("err", r.error);
      else flash("ok", t.providers.deleted);
    });
  };

  const onApplyMarginToProvider = (p: ProviderView) => {
    const pct = prompt(
      t.providers.promptBulkMargin.replace("{default}", String(Math.round(settings.defaultMarginPct * 100))),
      String(Math.round(settings.defaultMarginPct * 100))
    );
    if (!pct) return;
    const n = Number(pct);
    if (!Number.isFinite(n) || n < 0) return flash("err", t.providers.invalidMargin);
    startTransition(async () => {
      const r = await applyMarginToProvider(p.id, n / 100);
      if (r?.error) flash("err", r.error);
      else flash("ok", r.message || t.providers.saved);
    });
  };

  const onApplyMarginToModel = (m: ModelView) =>
    startTransition(async () => {
      const r = await applyMarginToModel(m.id);
      if (r?.error) flash("err", r.error);
      else flash("ok", t.providers.saved);
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">
            {t.providers.title}
          </h1>
          <p className="text-text-muted max-w-2xl">{t.providers.subtitle}</p>
        </div>
        <button
          onClick={() => setProviderModal({ mode: "create" })}
          className="px-4 py-2.5 bg-brand-primary text-brand-primary-text rounded-lg font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          + {t.providers.addProvider}
        </button>
      </div>

      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === "ok"
              ? "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <PlatformSettingsCard
        settings={settings}
        onSaved={(msg) => flash("ok", msg)}
        onError={(e) => flash("err", e)}
      />

      {providers.length === 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center text-text-muted">
          {t.providers.empty}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {providers.map((p) => {
          const expanded = expandedId === p.id;
          const enabledCount = p.models.filter((m) => m.isEnabled).length;
          return (
            <div
              key={p.id}
              className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Provider row */}
              <div className="flex items-center gap-4 p-5 flex-wrap">
                <button
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-90"
                >
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logoUrl} alt={p.name} className="w-10 h-10 rounded-lg object-contain bg-bg-main" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-main">{p.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-bg-main border border-border-subtle text-text-muted">
                        {p.protocol.toLowerCase()}
                      </span>
                      <span className="text-xs text-text-muted">
                        {enabledCount}/{p.models.length} {t.providers.modelsActive}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted truncate">{p.baseUrl}</div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.24 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={p.isEnabled}
                    onChange={() => onToggleProvider(p)}
                    disabled={isPending}
                    title={p.isEnabled ? t.providers.disable : t.providers.enable}
                  />
                  <button
                    onClick={() => onTest(p)}
                    className="px-3 py-1.5 rounded-md bg-bg-surface-hover hover:bg-border-subtle text-sm font-medium text-text-muted transition-colors"
                    disabled={isPending || !p.hasApiKey}
                    title={!p.hasApiKey ? t.providers.noApiKey : ""}
                  >
                    {t.providers.test}
                  </button>
                  <button
                    onClick={() => setProviderModal({ mode: "edit", data: p })}
                    className="px-3 py-1.5 rounded-md bg-bg-surface-hover hover:bg-border-subtle text-sm font-medium text-text-muted transition-colors"
                  >
                    {t.providers.edit}
                  </button>
                  <button
                    onClick={() => onDeleteProvider(p)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                    disabled={isPending}
                  >
                    {t.providers.delete}
                  </button>
                </div>
              </div>

              {/* Expanded: models */}
              {expanded && (
                <div className="border-t border-border-subtle bg-bg-main/40 p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-text-main">
                      {t.providers.modelsTitle}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => onApplyMarginToProvider(p)}
                        disabled={isPending || p.models.length === 0}
                        className="px-3 py-1.5 rounded-md bg-bg-surface-hover hover:bg-border-subtle text-sm font-medium text-text-muted transition-colors disabled:opacity-50"
                      >
                        {t.providers.applyMargin}
                      </button>
                      <button
                        onClick={() => onImport(p)}
                        disabled={isPending || !p.hasApiKey}
                        className="px-3 py-1.5 rounded-md bg-bg-surface-hover hover:bg-border-subtle text-sm font-medium text-text-muted transition-colors disabled:opacity-50"
                      >
                        {t.providers.importFromUpstream}
                      </button>
                      <button
                        onClick={() => setModelModal({ providerId: p.id, defaults: settings })}
                        className="px-3 py-1.5 rounded-md bg-brand-primary text-brand-primary-text text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        + {t.providers.addModel}
                      </button>
                    </div>
                  </div>

                  {p.models.length === 0 ? (
                    <div className="text-sm text-text-muted py-6 text-center">
                      {t.providers.noModels}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse min-w-[860px]">
                        <thead>
                          <tr className="text-text-muted border-b border-border-subtle">
                            <th className="py-2 pr-3 font-medium w-12">{t.providers.colEnabled}</th>
                            <th className="py-2 pr-3 font-medium">{t.providers.colModelId}</th>
                            <th className="py-2 pr-3 font-medium">{t.providers.colContext}</th>
                            <th className="py-2 pr-3 font-medium">{t.providers.colCost}</th>
                            <th className="py-2 pr-3 font-medium">{t.providers.colSelling}</th>
                            <th className="py-2 pr-3 font-medium">{t.providers.colMargin}</th>
                            <th className="py-2 pr-3 font-medium text-right">{t.providers.colActions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.models.map((m) => {
                            const margin = computeMargin(m);
                            const belowMin = margin !== null && margin < settings.minMarginPct;
                            return (
                              <tr key={m.id} className="border-b border-border-subtle last:border-0">
                                <td className="py-2.5 pr-3">
                                  <ToggleSwitch
                                    checked={m.isEnabled}
                                    onChange={() => onToggleModel(m)}
                                    disabled={isPending}
                                    small
                                  />
                                </td>
                                <td className="py-2.5 pr-3">
                                  <div className="flex flex-col gap-0.5">
                                    <code className="font-mono text-xs bg-bg-main px-2 py-1 rounded border border-border-subtle w-fit">
                                      {m.modelId}
                                    </code>
                                    <span className="text-xs text-text-muted">{m.displayName}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 pr-3 text-text-muted">
                                  {m.contextLength ? `${m.contextLength.toLocaleString()} tok` : "—"}
                                </td>
                                <td className="py-2.5 pr-3 text-text-muted text-xs font-mono">
                                  {m.costInputPer1k > 0 || m.costOutputPer1k > 0
                                    ? `$${m.costInputPer1k.toFixed(4)}/$${m.costOutputPer1k.toFixed(4)}`
                                    : "—"}
                                </td>
                                <td className="py-2.5 pr-3 text-text-main text-xs font-mono">
                                  ${m.inputPricePer1k.toFixed(4)}/${m.outputPricePer1k.toFixed(4)}
                                </td>
                                <td className="py-2.5 pr-3">
                                  {margin === null ? (
                                    <span className="text-xs text-text-muted">—</span>
                                  ) : (
                                    <span
                                      className={`text-xs font-semibold font-mono px-2 py-0.5 rounded ${
                                        belowMin
                                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                          : margin >= settings.defaultMarginPct
                                          ? "bg-green-500/10 text-green-700 dark:text-green-300"
                                          : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                                      }`}
                                      title={
                                        belowMin
                                          ? `Below platform minimum ${(settings.minMarginPct * 100).toFixed(0)}%`
                                          : ""
                                      }
                                    >
                                      {(margin * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 pr-3 text-right space-x-3">
                                  {(m.costInputPer1k > 0 || m.costOutputPer1k > 0) && (
                                    <button
                                      onClick={() => onApplyMarginToModel(m)}
                                      className="text-text-muted hover:text-brand-primary font-medium"
                                      title={t.providers.applyDefaultMargin}
                                      disabled={isPending}
                                    >
                                      {t.providers.reprice}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setModelModal({ providerId: p.id, data: m, defaults: settings })}
                                    className="text-text-muted hover:text-brand-primary font-medium"
                                  >
                                    {t.providers.edit}
                                  </button>
                                  <button
                                    onClick={() => onDeleteModel(m)}
                                    className="text-red-500 hover:text-red-400 font-medium"
                                    disabled={isPending}
                                  >
                                    {t.providers.delete}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {providerModal && (
        <ProviderModal
          mode={providerModal.mode}
          initial={providerModal.data}
          onClose={() => setProviderModal(null)}
          onSaved={(msg) => {
            flash("ok", msg);
            setProviderModal(null);
          }}
          onError={(e) => flash("err", e)}
        />
      )}

      {modelModal && (
        <ModelModal
          providerId={modelModal.providerId}
          initial={modelModal.data}
          defaults={modelModal.defaults ?? settings}
          onClose={() => setModelModal(null)}
          onSaved={(msg) => {
            flash("ok", msg);
            setModelModal(null);
          }}
          onError={(e) => flash("err", e)}
        />
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
  small,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
  small?: boolean;
}) {
  const w = small ? "w-8" : "w-10";
  const h = small ? "h-4" : "h-5";
  const knob = small ? "w-3 h-3" : "w-4 h-4";
  const translate = small ? (checked ? "translate-x-4" : "translate-x-0.5") : checked ? "translate-x-5" : "translate-x-0.5";
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      title={title}
      className={`${w} ${h} rounded-full transition-colors shrink-0 relative ${
        checked ? "bg-brand-primary" : "bg-bg-surface-hover"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 ${knob} bg-white rounded-full shadow transition-transform ${translate}`}
      />
    </button>
  );
}

function PlatformSettingsCard({
  settings,
  onSaved,
  onError,
}: {
  settings: PlatformSettingsView;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    defaultMarginPct: Math.round(settings.defaultMarginPct * 100),
    minMarginPct: Math.round(settings.minMarginPct * 100),
    autoApplyMargin: settings.autoApplyMargin,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await updatePlatformSettings({
        defaultMarginPct: form.defaultMarginPct / 100,
        minMarginPct: form.minMarginPct / 100,
        autoApplyMargin: form.autoApplyMargin,
      });
      if (r?.error) onError(r.error);
      else onSaved(t.providers.saved);
    });
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
      <h3 className="font-semibold text-text-main mb-1">{t.providers.settingsTitle}</h3>
      <p className="text-sm text-text-muted mb-4">{t.providers.settingsDesc}</p>
      <form onSubmit={submit} className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t.providers.defaultMarginLabel}
          </label>
          <input
            type="number"
            step="1"
            className={inputClass + " w-28"}
            value={form.defaultMarginPct}
            onChange={(e) => setForm({ ...form, defaultMarginPct: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t.providers.minMarginLabel}
          </label>
          <input
            type="number"
            step="1"
            className={inputClass + " w-28"}
            value={form.minMarginPct}
            onChange={(e) => setForm({ ...form, minMarginPct: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-main pb-2">
          <input
            type="checkbox"
            checked={form.autoApplyMargin}
            onChange={(e) => setForm({ ...form, autoApplyMargin: e.target.checked })}
            className="w-4 h-4"
          />
          {t.providers.autoApplyLabel}
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-brand-primary text-brand-primary-text rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "..." : t.providers.settingsSave}
        </button>
      </form>
    </div>
  );
}

function ProviderModal({
  mode,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  initial?: ProviderView;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    protocol: (initial?.protocol ?? "OPENAI") as ProviderProtocol,
    baseUrl: initial?.baseUrl ?? PROTOCOL_DEFAULTS.OPENAI,
    apiKey: "",
    logoUrl: initial?.logoUrl ?? "",
    description: initial?.description ?? "",
    sortOrder: initial?.sortOrder ?? 0,
    isEnabled: initial?.isEnabled ?? true,
  });

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...(mode === "edit" ? { id: initial!.id } : {}),
        name: form.name,
        slug: form.slug || slugify(form.name),
        protocol: form.protocol,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey || undefined,
        logoUrl: form.logoUrl,
        description: form.description,
        sortOrder: Number(form.sortOrder) || 0,
        isEnabled: form.isEnabled,
      };
      const r = mode === "create" ? await createProvider(payload) : await updateProvider(payload);
      if (r?.error) onError(r.error);
      else onSaved(t.providers.saved);
    });
  };

  return (
    <Modal onClose={onClose} title={mode === "create" ? t.providers.addProvider : t.providers.editProvider}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t.providers.fieldName}>
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="OpenAI"
            />
          </Field>
          <Field label={t.providers.fieldSlug} hint={t.providers.fieldSlugHint}>
            <input
              className={inputClass}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              placeholder="openai"
            />
          </Field>
        </div>

        <Field label={t.providers.fieldProtocol}>
          <select
            className={inputClass}
            value={form.protocol}
            onChange={(e) => {
              const next = e.target.value as ProviderProtocol;
              setForm((f) => ({
                ...f,
                protocol: next,
                baseUrl:
                  f.baseUrl === PROTOCOL_DEFAULTS[f.protocol] || !f.baseUrl
                    ? PROTOCOL_DEFAULTS[next]
                    : f.baseUrl,
              }));
            }}
          >
            <option value="OPENAI">OpenAI-Compatible</option>
            <option value="ANTHROPIC">Anthropic Native</option>
            <option value="GEMINI">Google Gemini</option>
          </select>
        </Field>

        <Field label={t.providers.fieldBaseUrl}>
          <input
            required
            className={inputClass}
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </Field>

        <Field
          label={t.providers.fieldApiKey}
          hint={mode === "edit" && initial?.apiKeyHint ? `${t.providers.current}: ${initial.apiKeyHint}` : t.providers.fieldApiKeyHint}
        >
          <input
            type="password"
            className={inputClass}
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={mode === "edit" ? t.providers.leaveEmptyToKeep : "sk-..."}
            autoComplete="new-password"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t.providers.fieldLogoUrl}>
            <input
              className={inputClass}
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          <Field label={t.providers.fieldSortOrder}>
            <input
              type="number"
              className={inputClass}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label={t.providers.fieldDescription}>
          <textarea
            className={inputClass + " min-h-[80px]"}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-text-main">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
            className="w-4 h-4"
          />
          {t.providers.fieldEnabled}
        </label>

        <ModalActions onCancel={onClose} disabled={isPending} submitLabel={t.providers.save} />
      </form>
    </Modal>
  );
}

function ModelModal({
  providerId,
  initial,
  defaults,
  onClose,
  onSaved,
  onError,
}: {
  providerId: string;
  initial?: ModelView;
  defaults?: PlatformSettingsView;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    modelId: initial?.modelId ?? "",
    displayName: initial?.displayName ?? "",
    description: initial?.description ?? "",
    contextLength: initial?.contextLength ?? 0,
    inputPricePer1k: initial?.inputPricePer1k ?? 0,
    outputPricePer1k: initial?.outputPricePer1k ?? 0,
    isEnabled: initial?.isEnabled ?? true,
    sortOrder: initial?.sortOrder ?? 0,
    capabilities: (initial?.capabilities ?? []).join(","),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...(initial?.id ? { id: initial.id } : {}),
        providerId,
        modelId: form.modelId,
        displayName: form.displayName || form.modelId,
        description: form.description,
        contextLength: Number(form.contextLength) || undefined,
        inputPricePer1k: Number(form.inputPricePer1k) || 0,
        outputPricePer1k: Number(form.outputPricePer1k) || 0,
        isEnabled: form.isEnabled,
        sortOrder: Number(form.sortOrder) || 0,
        capabilities: form.capabilities
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      };
      const r = initial?.id
        ? await updateProviderModel(payload)
        : await createProviderModel(payload);
      if (r?.error) onError(r.error);
      else onSaved(t.providers.saved);
    });
  };

  return (
    <Modal onClose={onClose} title={initial ? t.providers.editModel : t.providers.addModel}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t.providers.fieldModelId} hint={t.providers.fieldModelIdHint}>
          <input
            required
            className={inputClass + " font-mono"}
            value={form.modelId}
            onChange={(e) => setForm({ ...form, modelId: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </Field>
        <Field label={t.providers.fieldDisplayName}>
          <input
            className={inputClass}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="GPT-4o mini"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t.providers.fieldContext}>
            <input
              type="number"
              className={inputClass}
              value={form.contextLength}
              onChange={(e) => setForm({ ...form, contextLength: Number(e.target.value) })}
            />
          </Field>
          <Field label={t.providers.fieldInputPrice}>
            <input
              type="number"
              step="0.0001"
              className={inputClass}
              value={form.inputPricePer1k}
              onChange={(e) => setForm({ ...form, inputPricePer1k: Number(e.target.value) })}
            />
          </Field>
          <Field label={t.providers.fieldOutputPrice}>
            <input
              type="number"
              step="0.0001"
              className={inputClass}
              value={form.outputPricePer1k}
              onChange={(e) => setForm({ ...form, outputPricePer1k: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label={t.providers.fieldCapabilities} hint={t.providers.fieldCapabilitiesHint}>
          <input
            className={inputClass}
            value={form.capabilities}
            onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
            placeholder="vision, tools, json"
          />
        </Field>

        <Field label={t.providers.fieldDescription}>
          <textarea
            className={inputClass + " min-h-[70px]"}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-text-main">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
            className="w-4 h-4"
          />
          {t.providers.fieldEnabled}
        </label>

        <ModalActions onCancel={onClose} disabled={isPending} submitLabel={t.providers.save} />
      </form>
    </Modal>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-text-main">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-main text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-main mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function ModalActions({
  onCancel,
  disabled,
  submitLabel,
}: {
  onCancel: () => void;
  disabled: boolean;
  submitLabel: string;
}) {
  const { t } = useLang();
  return (
    <div className="flex gap-3 justify-end pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-lg font-medium text-text-muted hover:text-text-main hover:bg-bg-surface-hover transition-colors"
        disabled={disabled}
      >
        {t.providers.cancel}
      </button>
      <button
        type="submit"
        className="px-4 py-2 bg-brand-primary text-brand-primary-text rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        disabled={disabled}
      >
        {disabled ? "..." : submitLabel}
      </button>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-border-subtle bg-bg-main text-text-main rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all";
