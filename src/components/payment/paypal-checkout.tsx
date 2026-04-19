"use client";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/lang-context";

export default function PaypalCheckout({ amount, onSuccess }: { amount: number, onSuccess: () => void }) {
  const { t } = useLang();
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<{ clientId: string; mode: string } | null>(null);

  useEffect(() => {
    fetch("/api/payments/config")
      .then(res => res.json())
      .then(data => {
        if (data.paypalClientId) {
          setConfig({
            clientId: data.paypalClientId,
            mode: data.paypalMode || "sandbox"
          });
        } else {
          setError("PayPal is not configured by administrator");
        }
      })
      .catch(err => {
        console.error("Failed to load paypal config", err);
        setError("Failed to initialize payment system");
      });
  }, []);

  if (!config && !error) {
    return <div className="animate-pulse bg-bg-surface h-12 rounded-lg" />;
  }

  if (error) {
    return (
      <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full mt-4 min-h-[150px]">
      <PayPalScriptProvider options={{
        clientId: config!.clientId,
        currency: "USD",
        intent: "capture",
        // Pass the mode explicitly to react-paypal-js if needed, 
        // though usually it's derived from the clientId.
        // Forcing 'live' if configured:
        "data-sdk-integration-source": "button-factory"
      }}>
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
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to create order");
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
