import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { POLAR_CATALOG, pickTopupForAmount } from "@/lib/polar-catalog";

const POLAR_API = "https://api.polar.sh/v1";

function getToken() {
  const t = process.env.POLAR_ACCESS_TOKEN;
  if (!t) throw new Error("POLAR_ACCESS_TOKEN is not configured");
  return t;
}

async function polarFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${POLAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polar ${path} failed [${res.status}]: ${text}`);
  }
  return res.json();
}

function findProduct(productId: string) {
  return POLAR_CATALOG.topup.find((p) => p.id === productId);
}

export const listPolarCatalog = createServerFn({ method: "GET" }).handler(async () => {
  return POLAR_CATALOG;
});

export const createPolarCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        productId: z.string().min(1).max(64),
        origin: z.string().url().max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const product = findProduct(data.productId);
    if (!product) throw new Error("Unknown product");

    const { userId, claims } = context;
    const kind = "topup";

    const { data: purchase, error: insErr } = await supabaseAdmin
      .from("credit_purchases")
      .insert({
        user_id: userId,
        amount_usd: product.price,
        credits_added: product.credits,
        status: "pending",
        kind,
      })
      .select("id")
      .single();
    if (insErr || !purchase) {
      throw new Error(insErr?.message ?? "Could not create purchase record");
    }

    const successUrl = `${data.origin}/dashboard/credits?purchase=success&checkout_id={CHECKOUT_ID}`;
    const checkout = await polarFetch("/checkouts/", {
      method: "POST",
      body: JSON.stringify({
        products: [product.id],
        success_url: successUrl,
        external_customer_id: userId,
        customer_email: claims.email ?? undefined,
        metadata: {
          user_id: userId,
          purchase_id: purchase.id,
          product_id: product.id,
          credits: String(product.credits),
          kind,
        },
      }),
    });

    await supabaseAdmin
      .from("credit_purchases")
      .update({ polar_checkout_id: checkout.id })
      .eq("id", purchase.id);

    if (!checkout.url) throw new Error("Polar did not return a checkout URL");
    return { url: checkout.url as string };
  });

export const confirmPolarCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ checkoutId: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const checkout = await polarFetch(`/checkouts/${data.checkoutId}`);
    const status = checkout.status as string;
    if (status !== "succeeded") return { status, credited: false };

    const { data: purchase } = await supabaseAdmin
      .from("credit_purchases")
      .select("id, user_id, credits_added, status")
      .eq("polar_checkout_id", data.checkoutId)
      .maybeSingle();

    if (!purchase || purchase.user_id !== context.userId) {
      return { status, credited: false };
    }
    if (purchase.status === "completed") {
      return { status, credited: true };
    }
    // Webhook is the source of truth; if it already ran, status will be completed.
    return { status, credited: false };
  });

export const openPolarCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("polar_customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.polar_customer_id) {
      throw new Error("No subscription yet. Start an auto top-up first.");
    }
    const session = await polarFetch("/customer-sessions/", {
      method: "POST",
      body: JSON.stringify({ customer_id: profile.polar_customer_id }),
    });
    return { url: session.customer_portal_url as string };
  });

export const cancelAutoTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("profiles")
      .update({ auto_topup_active: false })
      .eq("id", userId);
    return { cancelled: true };
  });

export const saveAutoTopupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean(),
        threshold: z.number().min(1).max(100),
        amount: z.number().min(5).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("polar_customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (data.enabled && !profile?.polar_customer_id) {
      throw new Error(
        "Make at least one top-up first so we have a saved payment method on file.",
      );
    }
    await supabaseAdmin
      .from("profiles")
      .update({
        auto_topup_active: data.enabled,
        auto_topup_threshold: data.threshold,
        auto_topup_amount: data.amount,
      })
      .eq("id", userId);
    return { ok: true };
  });

export const triggerAutoTopupIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "credit_balance, auto_topup_active, auto_topup_threshold, auto_topup_amount, polar_customer_id, auto_topup_last_attempt_at",
      )
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.auto_topup_active) return { triggered: false, reason: "disabled" };
    const threshold = Number(profile.auto_topup_threshold ?? 0);
    const amount = Number(profile.auto_topup_amount ?? 0);
    const balance = Number(profile.credit_balance ?? 0);
    if (!threshold || !amount) return { triggered: false, reason: "missing-config" };
    if (balance >= threshold) return { triggered: false, reason: "above-threshold" };
    if (!profile.polar_customer_id) return { triggered: false, reason: "no-customer" };
    // Throttle: at most one attempt every 2 minutes.
    const last = profile.auto_topup_last_attempt_at ? new Date(profile.auto_topup_last_attempt_at).getTime() : 0;
    if (Date.now() - last < 2 * 60 * 1000) return { triggered: false, reason: "throttled" };

    const product = pickTopupForAmount(amount);
    if (!product) return { triggered: false, reason: "no-product" };

    await supabaseAdmin
      .from("profiles")
      .update({ auto_topup_last_attempt_at: new Date().toISOString() })
      .eq("id", userId);

    // Try Polar's off-session order creation against the saved customer.
    try {
      const order = await polarFetch("/orders/", {
        method: "POST",
        body: JSON.stringify({
          customer_id: profile.polar_customer_id,
          product_id: product.id,
          metadata: { user_id: userId, kind: "auto_topup" },
        }),
      });
      return {
        triggered: true,
        mode: "off_session" as const,
        orderId: order.id,
        productId: product.id,
        charged: product.price,
      };
    } catch (e) {
      // Fallback: create a hosted checkout link the client can show in a toast / email.
      try {
        const checkout = await polarFetch("/checkouts/", {
          method: "POST",
          body: JSON.stringify({
            products: [product.id],
            external_customer_id: userId,
            metadata: { user_id: userId, kind: "auto_topup_link" },
          }),
        });
        return {
          triggered: false,
          mode: "checkout_link" as const,
          checkoutUrl: checkout.url as string,
          productId: product.id,
          amount: product.price,
          reason: "polar-error",
          error: (e as Error).message,
        };
      } catch (e2) {
        return { triggered: false, reason: "polar-error", error: (e2 as Error).message };
      }
    }
  });

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "credit_balance, auto_topup_active, auto_topup_threshold, auto_topup_amount, polar_customer_id",
      )
      .eq("id", context.userId)
      .maybeSingle();
    return {
      creditBalance: Number(profile?.credit_balance ?? 0),
      autoTopupActive: !!profile?.auto_topup_active,
      autoTopupThreshold: profile?.auto_topup_threshold ? Number(profile.auto_topup_threshold) : 2,
      autoTopupAmount: profile?.auto_topup_amount ? Number(profile.auto_topup_amount) : 20,
      hasSavedCard: !!profile?.polar_customer_id,
    };
  });