import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/payments/razorpay/create-order
 *
 * Body: { amount: number (in paise, >=100), currency?: string, receipt?: string, notes?: Record<string,string> }
 * Returns: { order_id, amount, currency, key_id }
 *
 * Uses Razorpay REST API directly (fetch) so it runs on Cloudflare Workers.
 */
export const Route = createFileRoute("/api/public/payments/razorpay/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
          return json({ error: "Razorpay not configured" }, 503);
        }

        let body: {
          amount?: number;
          currency?: string;
          receipt?: string;
          notes?: Record<string, string>;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 100) {
          return json({ error: "amount must be an integer >= 100 (paise)" }, 400);
        }

        const currency = (body.currency ?? "INR").toUpperCase();
        const receipt = body.receipt ?? `rcpt_${Date.now()}`;

        const auth = btoa(`${keyId}:${keySecret}`);
        let res: Response;
        try {
          res = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
              amount,
              currency,
              receipt,
              notes: body.notes ?? {},
            }),
          });
        } catch (err) {
          return json(
            { error: "Failed to reach Razorpay", detail: err instanceof Error ? err.message : "network" },
            502,
          );
        }

        const data = (await res.json().catch(() => null)) as
          | { id?: string; amount?: number; currency?: string; error?: { description?: string } }
          | null;

        if (!res.ok || !data?.id) {
          if (res.status === 401) {
            return json({ error: "Razorpay auth failed" }, 401);
          }
          return json(
            { error: data?.error?.description ?? "Razorpay order creation failed", status: res.status },
            500,
          );
        }

        return json({
          order_id: data.id,
          amount: data.amount,
          currency: data.currency,
          key_id: keyId,
        });
      },
    },
  },
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
