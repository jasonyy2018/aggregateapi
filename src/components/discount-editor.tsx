"use client";

import { useState, useTransition } from "react";
import { updateUserDiscount } from "@/app/dashboard/admin/actions";

type DiscountEditorProps = {
  userId: string;
  initialDiscountRate: number;
  translations: {
    discountRate: string;
    discountLabel: string;
    updateDiscount: string;
    success: string;
    error: string;
  };
};

export function DiscountEditor({ userId, initialDiscountRate, translations }: DiscountEditorProps) {
  const [discountRate, setDiscountRate] = useState(initialDiscountRate);
  const [isPending, startTransition] = useTransition();

  const handleSave = async () => {
    startTransition(async () => {
      const res = await updateUserDiscount(userId, discountRate);
      if (res?.error) {
        alert(`${translations.error}: ${res.error}`);
      } else {
        alert(translations.success);
      }
    });
  };

  const percentOff = Math.round((1 - discountRate) * 100);
  const discountText = percentOff === 0
    ? "No Discount (无折扣)"
    : percentOff === 100
    ? "Free / 100% Off (免单)"
    : `${(10 - percentOff / 10).toFixed(1)}折 (优惠 ${percentOff}%)`;

  return (
    <div className="p-6 bg-bg-surface border border-border-subtle rounded-2xl shadow-sm flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
          <span>🏷️</span> {translations.discountRate}
        </h3>
        <p className="text-sm text-text-muted mt-1">{translations.discountLabel}</p>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <div className="flex justify-between items-center text-sm font-semibold text-text-main">
          <span>{discountText}</span>
          <span className="text-brand-primary font-bold text-lg">x{discountRate.toFixed(2)}</span>
        </div>

        <input
          type="range"
          min="0.0"
          max="1.0"
          step="0.05"
          value={discountRate}
          onChange={(e) => setDiscountRate(parseFloat(e.target.value))}
          className="w-full h-2 bg-bg-main rounded-lg appearance-none cursor-pointer accent-brand-primary border border-border-subtle"
          disabled={isPending}
        />
        
        <div className="flex justify-between text-xs text-text-muted mt-1 px-1">
          <span>0.00 (Free / 免单)</span>
          <span>0.50 (5折)</span>
          <span>1.00 (Standard / 无折)</span>
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-6 py-2.5 bg-brand-primary text-brand-primary-text font-semibold rounded-xl hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm text-sm"
        >
          {isPending ? "..." : translations.updateDiscount}
        </button>
      </div>
    </div>
  );
}
