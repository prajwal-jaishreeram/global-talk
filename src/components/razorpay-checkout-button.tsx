import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (resp: { error: { description: string } }) => void) => void;
};

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = CHECKOUT_SCRIPT;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export type RazorpayCheckoutButtonProps = {
  /** Amount in the smallest currency unit (paise for INR, cents for USD). Minimum 100. */
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  receipt?: string;
  notes?: Record<string, string>;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (resp: RazorpayHandlerResponse & { verified: true }) => void;
  onFailure?: (message: string) => void;
};

export function RazorpayCheckoutButton({
  amount,
  currency = "INR",
  name = "Global Talk",
  description,
  receipt,
  notes,
  prefill,
  themeColor = "#0ea5e9",
  label = "Pay now",
  className,
  disabled,
  onSuccess,
  onFailure,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error("Failed to load Razorpay checkout");
      }

      const orderRes = await fetch("/api/public/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, receipt, notes }),
      });
      const order = (await orderRes.json()) as {
        order_id?: string;
        amount?: number;
        currency?: string;
        key_id?: string;
        error?: string;
      };
      if (!orderRes.ok || !order.order_id) {
        throw new Error(order.error ?? "Could not create order");
      }

      const keyId =
        order.key_id ?? (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined);
      if (!keyId) throw new Error("Razorpay key is not configured");

      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount ?? amount,
        currency: order.currency ?? currency,
        name,
        description,
        order_id: order.order_id,
        prefill,
        notes,
        theme: { color: themeColor },
        modal: {
          ondismiss: () => {
            setLoading(false);
            onFailure?.("Payment cancelled");
          },
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/public/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = (await verifyRes.json()) as {
              verified?: boolean;
              error?: string;
            };
            if (!verifyRes.ok || !verifyData.verified) {
              throw new Error(verifyData.error ?? "Signature verification failed");
            }
            toast.success("Payment verified");
            onSuccess?.({ ...response, verified: true });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Verification failed";
            toast.error(msg);
            onFailure?.(msg);
          } finally {
            setLoading(false);
          }
        },
      });

      rzp.on("payment.failed", (resp) => {
        const msg = resp.error?.description ?? "Payment failed";
        toast.error(msg);
        onFailure?.(msg);
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start payment";
      toast.error(msg);
      onFailure?.(msg);
      setLoading(false);
    }
  }, [
    amount,
    currency,
    description,
    disabled,
    loading,
    name,
    notes,
    onFailure,
    onSuccess,
    prefill,
    receipt,
    themeColor,
  ]);

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className={className}
    >
      {loading ? "Processing…" : label}
    </Button>
  );
}

export default RazorpayCheckoutButton;
