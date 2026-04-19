"use client";

import { useState, useTransition } from "react";
import { useLang } from "@/lib/lang-context";
import { adjustUserBalance, toggleUserBan } from "@/app/dashboard/admin/actions";
import Link from "next/link";

type UserType = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  balance: number;
  isBanned: boolean;
  createdAt: Date;
};

export function AdminUsersTable({ users }: { users: UserType[] }) {
  const { t, locale } = useLang();
  const [isPending, startTransition] = useTransition();

  // Modal state
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [amountInput, setAmountInput] = useState("");

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    const amount = parseFloat(amountInput);
    if (isNaN(amount)) return;

    startTransition(async () => {
      const res = await adjustUserBalance(selectedUser.id, amount);
      if (res?.error) {
        alert(`${t.adminPage.error}: ${res.error}`);
      } else {
        alert(t.adminPage.success);
        setSelectedUser(null);
        setAmountInput("");
      }
    });
  };

  const handleToggleBan = async (user: UserType) => {
    if (!confirm(user.isBanned ? t.adminPage.unban + "?" : t.adminPage.ban + "?")) return;
    
    startTransition(async () => {
      const res = await toggleUserBan(user.id, !user.isBanned);
      if (res?.error) {
        alert(`${t.adminPage.error}: ${res.error}`);
      }
    });
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm relative">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-bg-surface-hover text-text-muted text-sm border-b border-border-subtle">
              <th className="px-6 py-4 font-medium">{t.adminPage.name}</th>
              <th className="px-6 py-4 font-medium">{t.adminPage.email}</th>
              <th className="px-6 py-4 font-medium">{t.adminPage.role}</th>
              <th className="px-6 py-4 font-medium">{t.adminPage.balance}</th>
              <th className="px-6 py-4 font-medium">{t.adminPage.date}</th>
              <th className="px-6 py-4 font-medium text-right">{t.adminPage.actions}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface-hover/50 transition-colors">
                <td className="px-6 py-4 text-text-main font-medium">{u.name || "N/A"}</td>
                <td className="px-6 py-4 text-text-muted">{u.email}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300' : 'bg-brand-primary/10 text-brand-primary'}`}>
                      {u.role}
                    </span>
                    {u.isBanned && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                        {t.adminPage.bannedStatus}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-text-main font-medium">${u.balance.toFixed(2)}</td>
                <td className="px-6 py-4 text-text-muted hide-on-mobile">{new Date(u.createdAt).toLocaleDateString(locale)}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <Link 
                    href={`/dashboard/admin/users/${u.id}`}
                    className="text-text-muted hover:text-brand-primary transition-colors text-sm font-medium"
                  >
                    {t.adminPage.details}
                  </Link>
                  <button 
                    onClick={() => setSelectedUser(u)}
                    className="text-text-muted hover:text-brand-primary transition-colors text-sm font-medium"
                    disabled={isPending}
                  >
                    {t.adminPage.adjustBalance}
                  </button>
                  <button 
                    onClick={() => handleToggleBan(u)}
                    className={`text-sm font-medium transition-colors ${u.isBanned ? 'text-green-600 hover:text-green-500' : 'text-red-500 hover:text-red-400'}`}
                    disabled={isPending}
                  >
                     {u.isBanned ? t.adminPage.unban : t.adminPage.ban}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                  {t.adminPage.noRecords}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Adjust Balance Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-text-main mb-4">{t.adminPage.adjustBalance} - {selectedUser.email}</h3>
            
            <form onSubmit={handleAdjustBalance} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t.adminPage.amount}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder={t.adminPage.amountPlaceholder}
                  className="w-full px-4 py-2 border border-border-subtle bg-bg-main text-text-main rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                  disabled={isPending}
                />
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => { setSelectedUser(null); setAmountInput(""); }}
                  className="px-4 py-2 rounded-lg font-medium text-text-muted hover:text-text-main hover:bg-bg-surface-hover transition-colors"
                  disabled={isPending}
                >
                  {t.adminPage.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary text-brand-primary-text rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                  disabled={isPending || !amountInput}
                >
                  {isPending ? "..." : t.adminPage.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
