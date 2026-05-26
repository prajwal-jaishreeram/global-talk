import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { POLAR_CATALOG } from "@/lib/polar-catalog";

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
  const all = [...POLAR_CATALOG.topup, ...POLAR_CATALOG.autoTopup];
  return all.find((p) => p.id === productId);
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
    const isSubscription = POLAR_CATALOG.autoTopup.some((p) => p.id === product.id);
    const kind = isSubscription ? "auto_topup_cycle" : "topup";

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
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("auto_topup_subscription_id")
      .eq("id", userId)
      .maybeSingle();
    const subId = profile?.auto_topup_subscription_id;
    if (!subId) return { cancelled: false };
    await polarFetch(`/subscriptions/${subId}`, {
      method: "PATCH",
      body: JSON.stringify({ cancel_at_period_end: true }),
    });
    return { cancelled: true };
  });

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "credit_balance, auto_topup_active, auto_topup_product_id, auto_topup_subscription_id",
      )
      .eq("id", context.userId)
      .maybeSingle();
    return {
      creditBalance: Number(profile?.credit_balance ?? 0),
      autoTopupActive: !!profile?.auto_topup_active,
      autoTopupProductId: profile?.auto_topup_product_id ?? null,
    };
  });