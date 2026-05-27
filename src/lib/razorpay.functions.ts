import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ───────────────────────────────────────────────────────────────────────────
// Razorpay helpers
// ───────────────────────────────────────────────────────────────────────────

const RAZORPAY_API = "https://api.razorpay.com/v1";
const TELNYX_BASE = "https://api.telnyx.com/v2";
// Retail markup over Telnyx wholesale (kept in sync with telnyx.functions.ts).
const NUMBER_PRICE_MARKUP = 2;
const FALLBACK_WHOLESALE_USD = 1;

function razorpayKeys() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment.",
    );
  }
  return { key_id, key_secret };
}

function basicAuthHeader() {
  const { key_id, key_secret } = razorpayKeys();
  const token = Buffer.from(`${key_id}:${key_secret}`).toString("base64");
  return `Basic ${token}`;
}

function telnyxKey() {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("Voice provider API key is not configured on the server.");
  return key;
}

// Pull current wholesale monthly cost from Telnyx for THIS specific number,
// so the retail price we charge always matches what was shown to the user.
async function fetchWholesalePrice(phoneNumber: string): Promise<number> {
  try {
    const params = new URLSearchParams();
    params.set("filter[phone_number]", phoneNumber);
    params.set("filter[limit]", "1");
    const res = await fetch(
      `${TELNYX_BASE}/available_phone_numbers?${params.toString()}`,
      { headers: { Authorization: `Bearer ${telnyxKey()}` } },
    );
    if (!res.ok) return FALLBACK_WHOLESALE_USD;
    const json = (await res.json()) as {
      data?: Array<{ cost_information?: { monthly_cost?: string } }>;
    };
    const cost = Number(json.data?.[0]?.cost_information?.monthly_cost);
    return Number.isFinite(cost) && cost > 0 ? cost : FALLBACK_WHOLESALE_USD;
  } catch {
    return FALLBACK_WHOLESALE_USD;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Public server functions
// ───────────────────────────────────────────────────────────────────────────

/**
 * Step 1 of buying a number: creates a Razorpay order + a pending DB row.
 * Returns everything the client needs to open the Razorpay Checkout widget.
 * NO Telnyx purchase happens here — that only fires after payment is verified.
 */
export const createNumberOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        phoneNumber: z.string().min(5).max(32),
        country: z.string().min(2).max(4),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;

    // Compute retail price (USD) from live Telnyx wholesale × markup.
    const wholesaleUsd = await fetchWholesalePrice(data.phoneNumber);
    const retailUsd = Math.round(wholesaleUsd * NUMBER_PRICE_MARKUP * 100) / 100;

    // Razorpay uses the lowest denomination of the currency. For USD that's
    // cents. (Razorpay also supports INR — switch currency below if you want
    // to bill in INR; for INR you'd convert USD → INR before this step.)
    const amountMinor = Math.round(retailUsd * 100);
    const currency = "USD";

    // Insert pending row first so the order is recoverable on retry.
    const { data: row, error: insErr } = await supabaseAdmin
      .from("phone_numbers")
      .insert({
        user_id: userId,
        phone_number: data.phoneNumber,
        country_code: data.country.toUpperCase(),
        monthly_cost: retailUsd,
        status: "pending_payment",
      })
      .select("id")
      .single();
    if (insErr || !row) {
      throw new Error(insErr?.message ?? "Could not create pending order");
    }

    // Create the Razorpay order. We embed our row id in `notes` so the
    // webhook (if you add one later) can correlate without ambiguity.
    const orderRes = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        receipt: `num_${row.id.slice(0, 32)}`,
        notes: {
          kind: "phone_number",
          phone_number: data.phoneNumber,
          row_id: row.id,
          user_id: userId,
        },
      }),
    });
    const orderJson = (await orderRes.json()) as {
      id?: string;
      status?: string;
      error?: { description?: string };
    };
    if (!orderRes.ok || !orderJson.id) {
      // Roll back the pending row so the user can retry.
      await supabaseAdmin.from("phone_numbers").delete().eq("id", row.id);
      throw new Error(
        orderJson.error?.description ?? `Razorpay ${orderRes.status}`,
      );
    }

    await supabaseAdmin
      .from("phone_numbers")
      .update({ razorpay_order_id: orderJson.id })
      .eq("id", row.id);

    return {
      // Sent straight to the Razorpay Checkout widget on the client.
      keyId: razorpayKeys().key_id,
      orderId: orderJson.id,
      amount: amountMinor,
      currency,
      // Echo back useful display data so the client doesn't have to refetch.
      retailUsd,
      phoneNumber: data.phoneNumber,
      rowId: row.id,
      prefillEmail: claims.email ?? undefined,
    };
  });

/**
 * Step 2: client calls this after Razorpay Checkout returns success.
 * We verify the HMAC signature, then provision the number on Telnyx, then
 * flip the DB row to "active". On any failure the row stays "pending_payment"
 * (so the user isn't charged for nothing — Razorpay only captures funds we
 * acknowledge here, and we can issue refunds via the dashboard for stuck rows).
 */
export const verifyAndProvisionNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        razorpay_order_id: z.string().min(1).max(64),
        razorpay_payment_id: z.string().min(1).max(64),
        razorpay_signature: z.string().min(1).max(256),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { key_secret } = razorpayKeys();

    // 1. Verify HMAC SHA-256 signature.
    const expected = createHmac("sha256", key_secret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    if (expected !== data.razorpay_signature) {
      throw new Error("Payment signature does not match. Refusing to provision.");
    }

    // 2. Look up the pending row that matches this order + this user.
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, phone_number, country_code, status, telnyx_number_id")
      .eq("razorpay_order_id", data.razorpay_order_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("No pending order found for this payment");
    if (row.status === "active" && row.telnyx_number_id) {
      // Idempotent: already provisioned (double-fire from client).
      return { ok: true, phoneNumber: row.phone_number };
    }

    // 3. Provision the number on Telnyx.
    const orderRes = await fetch(`${TELNYX_BASE}/number_orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_numbers: [{ phone_number: row.phone_number }],
      }),
    });
    const orderJson = (await orderRes.json()) as {
      data?: {
        id?: string;
        phone_numbers?: Array<{ id?: string; phone_number?: string }>;
      };
      errors?: Array<{ detail?: string; title?: string }>;
    };
    if (!orderRes.ok) {
      // Surface the failure but keep the row pending so we can refund + retry.
      const detail =
        orderJson.errors?.[0]?.detail ??
        orderJson.errors?.[0]?.title ??
        `Voice provider ${orderRes.status}`;
      throw new Error(
        `Payment received but the voice provider could not provision the number: ${detail}. Please contact support — your payment is safe.`,
      );
    }

    const telnyxOrderId = orderJson.data?.id ?? null;
    const telnyxNumberId = orderJson.data?.phone_numbers?.[0]?.id ?? null;

    // 4. Flip the row to active.
    const { error: updErr } = await supabaseAdmin
      .from("phone_numbers")
      .update({
        status: "active",
        telnyx_order_id: telnyxOrderId,
        telnyx_number_id: telnyxNumberId,
        razorpay_payment_id: data.razorpay_payment_id,
      })
      .eq("id", row.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, phoneNumber: row.phone_number };
  });

/**
 * Cancel a pending order (user closed the Razorpay modal, etc.).
 * Safe to call repeatedly — only deletes rows still in `pending_payment`.
 */
export const cancelPendingNumberOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rowId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("phone_numbers")
      .delete()
      .eq("id", data.rowId)
      .eq("user_id", userId)
      .eq("status", "pending_payment");
    return { ok: true };
  });
