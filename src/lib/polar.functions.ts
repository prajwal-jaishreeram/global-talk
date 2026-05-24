import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const POLAR_API = "https://api.polar.sh/v1";

// Catalog created via Polar MCP. Keep server-side so client cannot tamper.
export const POLAR_CATALOG = {
  topup: [
    { id: "7b998b07-0020-483d-899e-f322454bbc6e", price: 5, credits: 5, label: "$5" },
    { id: "6d2f43bc-ab1e-4016-be04-d43b2731b023", price: 10, credits: 10, label: "$10" },
    { id: "49b4d84d-f656-441b-9402-553173f1d1a5", price: 25, credits: 27.5, label: "$25", bonusLabel: "+10% bonus" },
    { id: "03b322b2-1d11-42ab-83f4-e64df7460afd", price: 50, credits: 60, label: "$50", bonusLabel: "+20% bonus" },
  ],
  autoTopup: [
    { id: "67c177b6-7a2a-4a8a-9fcf-412b1f69655c", price: 10, credits: 10, label: "$10/mo" },
    { id: "1dfc7636-8c38-4caf-8d15-63a595c78e13", price: 25, credits: 27.5, label: "$25/mo", bonusLabel: "+10%" },
    { id: "3a5d33d3-9e3d-4bef-bc98-2207b2285eae", price: 50, credits: 60, label: "$50/mo", bonusLabel: "+20%" },
  ],
} as const;

function getToken() {
  const t = process.env.POLAR_ACCESS_TOKEN;
  if (!t) throw new Error("POLAR_ACCESS_TOKEN is not configured");
  return t;
}

function origin() {
  const host = getRequestHost();
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
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
    z.object({ productId: z.string().min(1).max(64) }).parse(input),
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

    const successUrl = `${origin()}/dashboard/credits?purchase=success&checkout_id={CHECKOUT_ID}`;
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