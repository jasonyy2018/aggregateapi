"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getProvidersAndModels,
  addUserSubscription,
  deleteUserSubscription,
  toggleUserSubscription
} from "@/app/dashboard/admin/actions";

interface UserSubscriptionProps {
  userId: string;
  initialSubscriptions: any[];
}

export function SubscriptionManager({ userId, initialSubscriptions }: UserSubscriptionProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [providers, setProviders] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [price, setPrice] = useState<number>(0.0);
  const [isUnlimited, setIsUnlimited] = useState<boolean>(true);
  const [tokenLimit, setTokenLimit] = useState<number>(1000000);
  
  // Default start date = today, end date = 30 days later
  const [startDate, setStartDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  useEffect(() => {
    // Sync initialSubscriptions when parent updates
    setSubscriptions(initialSubscriptions);
  }, [initialSubscriptions]);

  useEffect(() => {
    // Fetch available providers and models for form selection
    const fetchOptions = async () => {
      const res = await getProvidersAndModels();
      if (res?.success) {
        setProviders(res.providers);
      }
    };
    fetchOptions();
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProviderId(e.target.value);
    setSelectedModelId(""); // reset model when provider changes
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId) {
      alert("Please select a provider.");
      return;
    }

    startTransition(async () => {
      const res = await addUserSubscription(userId, {
        providerId: selectedProviderId,
        providerModelId: selectedModelId || undefined,
        price,
        tokenLimit: isUnlimited ? null : tokenLimit,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      if (res?.error) {
        alert(`Error: ${res.error}`);
      } else {
        alert("Subscription added successfully!");
        setShowAddForm(false);
        // Reset form
        setSelectedProviderId("");
        setSelectedModelId("");
        setPrice(0.0);
        setIsUnlimited(true);
      }
    });
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    startTransition(async () => {
      const res = await toggleUserSubscription(userId, id, !currentActive);
      if (res?.error) {
        alert(`Error: ${res.error}`);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;
    startTransition(async () => {
      const res = await deleteUserSubscription(userId, id);
      if (res?.error) {
        alert(`Error: ${res.error}`);
      }
    });
  };

  // Find models for selected provider
  const activeProvider = providers.find((p) => p.id === selectedProviderId);
  const models = activeProvider?.models || [];

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm flex flex-col overflow-hidden">
      <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-bg-surface-hover/20">
        <div>
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <span>📅</span> Monthly Packages & Subscriptions (包月套餐管理)
          </h2>
          <p className="text-sm text-text-muted mt-1">Assign custom provider/model packages with token quotas.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-brand-primary text-brand-primary-text font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all text-sm"
        >
          {showAddForm ? "Cancel" : "Add Package"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddSubscription} className="p-6 border-b border-border-subtle bg-bg-main/50 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text-main">Configure New Package</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Provider (供应商)</label>
              <select
                value={selectedProviderId}
                onChange={handleProviderChange}
                required
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
              >
                <option value="">-- Select Provider --</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Model (具体模型 - 选填)</label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                disabled={!selectedProviderId}
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary disabled:opacity-50"
              >
                <option value="">All Models of Provider (适用于所有模型)</option>
                {models.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.modelId})
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Package Price (USD 价格)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                required
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Token Limit Toggle */}
            <div className="flex flex-col gap-1 justify-end">
              <div className="flex items-center gap-4 py-2">
                <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={isUnlimited}
                    onChange={(e) => setIsUnlimited(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-border-subtle cursor-pointer"
                  />
                  Unlimited Tokens (不限量)
                </label>
              </div>
            </div>

            {/* Token Limit (if not unlimited) */}
            {!isUnlimited && (
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs text-text-muted font-semibold">Token Limit (限量大小)</label>
                <input
                  type="number"
                  min="1"
                  value={tokenLimit}
                  onChange={(e) => setTokenLimit(parseInt(e.target.value))}
                  required
                  className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
                  placeholder="e.g. 1000000"
                />
              </div>
            )}

            {/* Start Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Start Date (开始日期)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">End Date (截止日期)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-border-subtle text-text-main font-semibold rounded-xl hover:bg-bg-surface text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-brand-primary text-brand-primary-text font-semibold rounded-xl hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all text-sm"
            >
              {isPending ? "Adding..." : "Add Subscription"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border-subtle bg-bg-surface-hover/30">
              <th className="px-6 py-4 font-semibold">Coverage</th>
              <th className="px-6 py-4 font-semibold">Quota (Used / Limit)</th>
              <th className="px-6 py-4 font-semibold">Price</th>
              <th className="px-6 py-4 font-semibold">Duration</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {subscriptions.map((sub) => {
              const coverageText = sub.providerModel
                ? `${sub.provider?.name || sub.providerId} / ${sub.providerModel.displayName || sub.providerModelId}`
                : `${sub.provider?.name || sub.providerId} (All Models)`;

              const limitText = sub.tokenLimit === null ? "Unlimited" : sub.tokenLimit.toLocaleString();
              const usedText = sub.tokenUsed.toLocaleString();
              
              const isExpired = new Date(sub.endDate) < new Date();
              const isActive = sub.isActive && !isExpired;

              return (
                <tr key={sub.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface-hover/30">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-text-main">{coverageText}</p>
                    {isExpired && <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">EXPIRED</span>}
                  </td>
                  <td className="px-6 py-4 text-text-main">
                    <p>{usedText} / <span className="font-semibold">{limitText}</span></p>
                    {sub.tokenLimit !== null && (
                      <div className="w-32 bg-bg-main h-1.5 rounded-full mt-1.5 overflow-hidden border border-border-subtle">
                        <div
                          className="bg-brand-primary h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (sub.tokenUsed / sub.tokenLimit) * 100)}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-text-main font-semibold">${sub.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-text-muted text-xs">
                    {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2 items-center min-h-[58px]">
                    <button
                      onClick={() => handleToggleActive(sub.id, sub.isActive)}
                      disabled={isPending || isExpired}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-300 hover:bg-green-500/20"
                          : "bg-text-muted/10 text-text-muted hover:bg-text-muted/20"
                      } disabled:opacity-50`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  No subscriptions or monthly packages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
