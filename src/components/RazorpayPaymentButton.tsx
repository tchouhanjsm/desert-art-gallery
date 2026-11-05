"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentSession = {
  order_id: string;
  order_number: string;
  razorpay_order_id: string;
  key_id: string;
  amount: number;
  currency: string;
};

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutInstance = {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler(response: RazorpayCheckoutResponse): void;
  modal: { ondismiss(): void };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

let checkoutScriptPromise: Promise<void> | null = null;

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Payment checkout is available in a browser only."));
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("Payment checkout did not initialise."));
    script.onerror = () => reject(new Error("Payment checkout could not be loaded. Check your connection and retry."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    checkoutScriptPromise = null;
    throw error;
  });
  return checkoutScriptPromise;
}

export function RazorpayPaymentButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startPayment() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error("Payment checkout is unavailable.");

      idempotencyKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/payments/razorpay/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({ orderId }),
        cache: "no-store",
      });
      const session = await response.json() as PaymentSession & { error?: string };
      if (!response.ok) throw new Error(session.error || "The payment session could not be created.");

      const checkout = new window.Razorpay({
        key: session.key_id,
        amount: session.amount,
        currency: session.currency,
        name: "Desert Art Gallery",
        description: "Order " + (session.order_number || orderNumber),
        order_id: session.razorpay_order_id,
        theme: { color: "#A54E34" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage("The payment window was closed. No payment is confirmed until the provider verifies capture.");
          },
        },
        handler: async (payment) => {
          try {
            const verification = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
              }),
              cache: "no-store",
            });
            const result = await verification.json() as { status?: string; message?: string; error?: string };
            if (!verification.ok) throw new Error(result.error || "Payment verification is pending.");
            if (result.status === "paid") {
              setMessage("Payment captured and verified. Your order is confirmed.");
              router.refresh();
            } else {
              setMessage(result.message || "Payment is not yet captured. The order will not be fulfilled until capture is verified.");
              router.refresh();
            }
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Payment verification is pending. Do not pay again; refresh the order or contact support.");
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on("payment.failed", (event) => {
        setMessage(event.error?.description || "The payment attempt failed. No fulfilment action was taken.");
        setBusy(false);
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The payment session could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="checkout-payment-action">
      <p className="checkout-notice" role="note">Sandbox payment mode is enabled for this environment. An order is confirmed only after the provider reports a verified captured payment.</p>
      <button type="button" className="button-primary dark-button" disabled={busy} onClick={startPayment}>
        {busy ? "CONNECTING TO PAYMENT…" : "CONTINUE TO TEST PAYMENT"}
      </button>
      {message && <p className="checkout-notice" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
