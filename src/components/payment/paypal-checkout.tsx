"use client";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useState } from "react";
import { useLang } from "@/lib/lang-context";

export default function PaypalCheckout({ amount, onSuccess }: { amount: number, onSuccess: () => void }) {
  const { t } = useLang();
  const [error, setError] = useState<string | null>(null);

  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
    currency: "USD",
    intent: "capture",
  };

  return (
    <div className="w-full mt-4 min-h-[150px]">
      {error && (
        <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          {error}
        </div>
      )}
      
      <PayPalScriptProvider options={initialOptions}>
        <PayPalButtons
          style={{ layout: "vertical", color: "blue", shape: "rect", label: "pay" }}
          createOrder={async () => {
            try {
              const res = await fetch("/api/payments/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: amount.toString() }),
              });
              
              if (!res.ok) {
                throw new Error("Failed to create order");
              }
              const order = await res.json();
              return order.id;
            } catch (err: any) {
              setError(err.message);
              return null;
            }
          }}
          onApprove={async (data, actions) => {
            try {
              const res = await fetch("/api/payments/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderID: data.orderID }),
              });

              if (res.ok) {
                const details = await res.json();
                console.log("Capture result", details);
                onSuccess(); // Triggers parent refresh or success message
              } else {
                throw new Error("Failed to capture order");
              }
            } catch (err: any) {
              setError(err.message);
            }
          }}
          onError={(err) => {
            console.error("PayPal Error:", err);
            setError("PayPal encountered an unexpected error.");
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
