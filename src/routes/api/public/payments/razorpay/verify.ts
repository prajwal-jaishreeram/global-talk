import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/payments/razorpay/verify
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Verifies HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) using Web Crypto.
 * Returns: { verified: true } on match.
 */
export const Route = createFileRoute("/api/public/payments/razorpay/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
          return json({ error: "Razorpay not configured" }, 503);
        }

        let body: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          return json({ error: "Missing required fields" }, 400);
        }

        const expected = await hmacSha256Hex(
          `${razorpay_order_id}|${razorpay_payment_id}`,
          keySecret,
        );

        if (!timingSafeEqual(expected, razorpay_signature)) {
          return json({ verified: false, error: "Signature mismatch" }, 400);
        }

        return json({
          verified: true,
          razorpay_order_id,
          razorpay_payment_id,
        });
      },
    },
  },
});

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
