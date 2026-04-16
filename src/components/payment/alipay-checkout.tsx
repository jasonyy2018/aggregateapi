"use client";

import { useLang } from "@/lib/lang-context";
import { useState } from "react";

export default function AlipayCheckout({ amount }: { amount: number }) {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/alipay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount.toString() }),
      });

      if (!res.ok) {
        throw new Error("Failed to initialize Alipay");
      }
      
      const { url } = await res.json();
      
      if (url) {
        // Redirect completely to Alipay gateway
        window.location.href = url;
      } else {
        throw new Error("Alipay Gateway URL is missing");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Alipay Gateway. Make sure ALIPAY_ keys are correctly set.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mt-4">
      {error && (
        <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          {error}
        </div>
      )}
      <button 
        onClick={handlePayment}
        disabled={loading}
        className="w-full h-12 bg-[#1677FF] hover:bg-[#1677FF]/90 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M885.6 230.2H736.4v-42.3c0-11-8.9-19.9-19.9-19.9h-89.1c-11 0-19.9 8.9-19.9 19.9v42.3H458.3v-42.3c0-11-8.9-19.9-19.9-19.9h-89.1c-11 0-19.9 8.9-19.9 19.9v42.3H180.2c-11 0-19.9 8.9-19.9 19.9v89.1c0 11 8.9 19.9 19.9 19.9h156.4v54h-172c-11 0-19.9 8.9-19.9 19.9v89.1c0 11 8.9 19.9 19.9 19.9h303.4v62.4c-45.7 13.5-97.3 22.8-154.5 27-61.9 4.5-126.3 3.5-192.1-3 0 0-32-6.5-43-8 0 0-48.4-1.5-35.8 40.73 13 43.6 44 148.2 44 148.2 5 15.5 19 23.5 35 25.5 137.2 16 250.7-3.5 330.4-56.1 42.1 63.8 107.5 119.6 195.9 161.4 79.5 37.6 154.1 53 154.1 53 23-4 44-31 52-52 8-21 21-65.6 27-86s8-41-11-53c-19-12-87.3-33-146.5-68.5-56-33.6-103.8-77.4-142.1-128H875c12-3.1 20.4-14.8 20.4-28.9v-79.6c0-16.5-13.4-29.9-29.9-29.9H624.5v-62h261.2c16.5 0 29.9-13.4 29.9-29.9v-80.1c-1.1-17.6-15.5-30.8-33.1-30Zm-366.8 54h105.7v54H518.8v-54Z" />
          </svg>
        )}
        {t.billingPage.payWithAlipay}
      </button>
    </div>
  );
}
