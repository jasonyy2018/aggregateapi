"use client";

import { useState, useTransition } from "react";
import { addSubscriptionPlan, deleteSubscriptionPlan, toggleSubscriptionPlan, updateSubscriptionPlan } from "@/app/dashboard/admin/actions";

interface PlanManagerProps {
  providerId: string;
  providerModels: any[];
  initialPlans: any[];
}

export function PlanManager({ providerId, providerModels, initialPlans }: PlanManagerProps) {
  const [plans, setPlans] = useState<any[]>(initialPlans);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(true);
  const [tokenLimit, setTokenLimit] = useState<number>(1000000);

  const openAddForm = () => {
    setEditingPlan(null);
    setShowAddForm(true);
    // Reset states
    setNameEn("");
    setNameZh("");
    setDescriptionEn("");
    setDescriptionZh("");
    setPrice(0);
    setDurationDays(30);
    setSelectedModelId("");
    setIsUnlimited(true);
  };

  const openEditForm = (plan: any) => {
    setShowAddForm(false);
    setEditingPlan(plan);
    // Populate form states
    setNameEn(plan.nameEn);
    setNameZh(plan.nameZh);
    setDescriptionEn(plan.descriptionEn || "");
    setDescriptionZh(plan.descriptionZh || "");
    setPrice(plan.price);
    setDurationDays(plan.durationDays);
    setSelectedModelId(plan.providerModelId || "");
    setIsUnlimited(plan.tokenLimit === null);
    setTokenLimit(plan.tokenLimit || 1000000);
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn || !nameZh) {
      alert("Name is required in both English and Chinese.");
      return;
    }

    startTransition(async () => {
      const res = await addSubscriptionPlan(providerId, {
        nameEn,
        nameZh,
        descriptionEn,
        descriptionZh,
        price,
        durationDays,
        providerModelId: selectedModelId || undefined,
        tokenLimit: isUnlimited ? null : tokenLimit
      });

      if (res?.error) {
        alert(`Error: ${res.error}`);
      } else if (res?.success && res.plan) {
        alert("Subscription Plan created successfully!");
        setShowAddForm(false);
        // Refresh local view by appending the real database plan object returned from server
        const mappedPlan = {
          ...res.plan,
          providerModel: selectedModelId ? providerModels.find((m) => m.id === selectedModelId) : null
        };
        setPlans([mappedPlan, ...plans]);
      }
    });
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (!nameEn || !nameZh) {
      alert("Name is required in both English and Chinese.");
      return;
    }

    startTransition(async () => {
      const res = await updateSubscriptionPlan(providerId, editingPlan.id, {
        nameEn,
        nameZh,
        descriptionEn,
        descriptionZh,
        price,
        durationDays,
        providerModelId: selectedModelId || undefined,
        tokenLimit: isUnlimited ? null : tokenLimit
      });

      if (res?.error) {
        alert(`Error: ${res.error}`);
      } else if (res?.success && res.plan) {
        alert("Subscription Plan updated successfully!");
        const updatedPlan = {
          ...res.plan,
          providerModel: selectedModelId ? providerModels.find((m) => m.id === selectedModelId) : null
        };
        setPlans(plans.map((p) => (p.id === editingPlan.id ? updatedPlan : p)));
        setEditingPlan(null);
      }
    });
  };

  const handleToggleActive = (planId: string, currentActive: boolean) => {
    startTransition(async () => {
      const res = await toggleSubscriptionPlan(providerId, planId, !currentActive);
      if (res?.error) {
        alert(`Error: ${res.error}`);
      } else {
        setPlans(plans.map((p) => (p.id === planId ? { ...p, isActive: !currentActive } : p)));
      }
    });
  };

  const handleDeletePlan = (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan? This will set-null plan references for users subscribed to it.")) return;
    startTransition(async () => {
      const res = await deleteSubscriptionPlan(providerId, planId);
      if (res?.error) {
        alert(`Error: ${res.error}`);
      } else {
        setPlans(plans.filter((p) => p.id !== planId));
      }
    });
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm overflow-hidden mt-8">
      <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-bg-surface-hover/20">
        <div>
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <span>📦</span> Subscription Packages & Plans (订购套餐设置)
          </h2>
          <p className="text-sm text-text-muted mt-1">Configure monthly or yearly packages for this provider.</p>
        </div>
        {!showAddForm && !editingPlan ? (
          <button
            onClick={openAddForm}
            className="px-4 py-2 bg-brand-primary text-brand-primary-text font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all text-sm"
          >
            Add Plan
          </button>
        ) : (
          <button
            onClick={() => {
              setShowAddForm(false);
              setEditingPlan(null);
            }}
            className="px-4 py-2 border border-border-subtle text-text-main font-semibold rounded-xl hover:bg-bg-surface text-sm"
          >
            Cancel
          </button>
        )}
      </div>

      {(showAddForm || editingPlan) && (
        <form onSubmit={editingPlan ? handleUpdatePlan : handleAddPlan} className="p-6 border-b border-border-subtle bg-bg-main/30 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text-main">
            {editingPlan ? `Edit Plan: ${editingPlan.nameZh}` : "Configure New Plan"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* English Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Plan Name (English)</label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
                placeholder="e.g. OpenAI Unlimited Monthly"
              />
            </div>

            {/* Chinese Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Plan Name (中文)</label>
              <input
                type="text"
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                required
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
                placeholder="例如：OpenAI 不限量包月套餐"
              />
            </div>

            {/* English Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Description (English)</label>
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={2}
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary resize-none"
                placeholder="Description shown to English users"
              />
            </div>

            {/* Chinese Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Description (中文)</label>
              <textarea
                value={descriptionZh}
                onChange={(e) => setDescriptionZh(e.target.value)}
                rows={2}
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary resize-none"
                placeholder="展示给中文用户的介绍"
              />
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Price (USD)</label>
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

            {/* Duration Days */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Duration (Days)</label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
              >
                <option value={30}>30 Days (Monthly / 包月)</option>
                <option value={90}>90 Days (Quarterly / 包季)</option>
                <option value={365}>365 Days (Yearly / 包年)</option>
              </select>
            </div>

            {/* Target Model */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-semibold">Target Model (具体模型 - 选填)</label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="p-2.5 rounded-xl border border-border-subtle bg-bg-surface text-text-main text-sm focus:outline-none focus:border-brand-primary"
              >
                <option value="">All Models of Provider (适用于全部模型)</option>
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.modelId})
                  </option>
                ))}
              </select>
            </div>

            {/* Token Limit */}
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
                  placeholder="e.g. 10000000"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingPlan(null);
              }}
              className="px-4 py-2 border border-border-subtle text-text-main font-semibold rounded-xl hover:bg-bg-surface text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-brand-primary text-brand-primary-text font-semibold rounded-xl hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all text-sm"
            >
              {isPending ? "Saving..." : (editingPlan ? "Update Plan" : "Create Plan")}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border-subtle bg-bg-surface-hover/30">
              <th className="px-6 py-4 font-semibold">Plan Name</th>
              <th className="px-6 py-4 font-semibold">Coverage</th>
              <th className="px-6 py-4 font-semibold">Price</th>
              <th className="px-6 py-4 font-semibold">Quota / Duration</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {plans.map((p) => {
              const coverageText = p.providerModel
                ? p.providerModel.displayName || p.providerModelId
                : "All Models";
              const quotaText = p.tokenLimit === null ? "Unlimited" : p.tokenLimit.toLocaleString();

              return (
                <tr key={p.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface-hover/30">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-text-main">{p.nameZh}</p>
                    <p className="text-xs text-text-muted">{p.nameEn}</p>
                  </td>
                  <td className="px-6 py-4 text-text-main font-medium">{coverageText}</td>
                  <td className="px-6 py-4 text-text-main font-bold font-mono">${p.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-text-muted text-xs">
                    <p>{quotaText} Tokens</p>
                    <p>{p.durationDays} Days validity</p>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2 items-center min-h-[58px]">
                    <button
                      onClick={() => openEditForm(p)}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-surface-hover border border-border-subtle text-text-main hover:bg-border-subtle transition-all disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(p.id, p.isActive)}
                      disabled={isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        p.isActive
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-300 hover:bg-green-500/20"
                          : "bg-text-muted/10 text-text-muted hover:bg-text-muted/20"
                      } disabled:opacity-50`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => handleDeletePlan(p.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  No subscription plans created for this provider yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
