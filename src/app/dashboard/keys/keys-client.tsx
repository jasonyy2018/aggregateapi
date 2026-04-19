"use client";

import { useState } from "react";
import { createApiKey, toggleApiKeyStatus, deleteApiKey } from "./actions";
import { useLang } from "@/lib/lang-context";
import { Copy, Trash2, ShieldAlert, ShieldCheck, Check, Key } from "lucide-react";

interface KeyType {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: Date;
}

export function KeysClient({ initialKeys }: { initialKeys: KeyType[] }) {
  const { t } = useLang();
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    const result = await createApiKey(newKeyName || "My API Key");
    if (result.success && result.key) {
      setCreatedKey(result.key);
      setShowModal(true);
      setNewKeyName("");
    } else {
      alert(result.error || "Failed to create key");
    }
    setLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Creation UI */}
      <div className="flex flex-col md:flex-row gap-4 items-end bg-bg-surface border border-border-subtle p-6 rounded-2xl shadow-sm">
        <div className="flex-1 flex flex-col gap-2 w-full">
          <label className="text-sm font-medium text-text-main">{t.keys.keyNameLabel || "Key Name"}</label>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Production Backend"
            className="w-full px-4 py-2 bg-bg-main border border-border-subtle rounded-lg focus:outline-none focus:border-brand-primary text-text-main"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="h-11 px-6 bg-brand-primary text-brand-primary-text rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap"
        >
          {loading ? "Creating..." : `+ ${t.keys.create}`}
        </button>
      </div>

      {/* Keys List */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
        {initialKeys.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-bg-main rounded-full flex items-center justify-center text-text-muted">
              <Key size={24} />
            </div>
            <p className="text-text-muted font-medium">{t.keys.noKeys || "No API keys created yet."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {initialKeys.map((k) => (
              <div key={k.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-bg-surface-hover transition-colors">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-text-main">{k.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${k.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {k.isActive ? t.keys.active : t.keys.revoked}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 group">
                    <code className="text-xs text-text-muted bg-bg-main px-2 py-1 rounded border border-border-subtle">
                      {k.key.substring(0, 12)}••••••••••••••••
                    </code>
                  </div>
                  <span className="text-[10px] text-text-muted">Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleApiKeyStatus(k.id, !k.isActive)}
                    className={`p-2 rounded-lg transition-colors ${k.isActive ? 'text-text-muted hover:bg-red-500/10 hover:text-red-500' : 'text-text-muted hover:bg-green-500/10 hover:text-green-500'}`}
                    title={k.isActive ? t.keys.revoke : t.keys.activate}
                  >
                    {k.isActive ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                  </button>
                  <button
                    onClick={() => { if(confirm("Are you sure?")) deleteApiKey(k.id) }}
                    className="p-2 text-text-muted hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-border-subtle p-8 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-text-main">{t.keys.successTitle || "API Key Created"}</h2>
              <p className="text-text-muted text-sm">
                {t.keys.successDesc || "Please copy this key and save it somewhere safe. For your security, we won't show it again."}
              </p>
            </div>

            <div className="relative group mb-8">
              <code className="block w-full p-4 bg-bg-main border-2 border-brand-primary/20 rounded-xl text-brand-primary font-mono text-sm break-all pr-12">
                {createdKey}
              </code>
              <button
                onClick={() => handleCopy(createdKey || "")}
                className="absolute right-3 top-3 p-2 bg-brand-primary text-brand-primary-text rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-3 bg-text-main text-bg-main rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              {t.keys.done || "I've saved the key"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
