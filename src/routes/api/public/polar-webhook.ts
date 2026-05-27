import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "standardwebhooks";
import { Buffer } from "node:buffer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { POLAR_CATALOG } from "@/lib/polar-catalog";

function verify(body: string, headers: Headers) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) throw new Error("POLAR_WEBHOOK_SECRET not configured");
  const base64 = Buffer.from(secret, "utf-8").toString("base64");
  const wh = new Webhook(base64);
  const hdrs: Record<string, string> = {};
  headers.forEach((v, k) => {
    hdrs[k] = v;
  });
  return wh.verify(body, hdrs) as { type: string; data: Record<string, unknown> };
}

async function creditUser(opts: {
  userId: string;
  credits: number;
  amountUsd: number;
  polarOrderId: string;
  polarCheckoutId?: string | null;
  polarSubscriptionId?: string | null;
  kind: string;
}) {
  // Idempotency: bail if this order has already been credited.
  const { data: existing } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, status")
    .eq("polar_order_id", opts.polarOrderId)
    .maybeSingle();
  if (existing?.status === "completed") return;

  if (existing) {
    // The checkout-created row exists; complete it.
    const { error: rpcErr } = await supabaseAdmin.rpc("add_credits", {
      _user_id: opts.userId,
      _amount: opts.credits,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    await supabaseAdmin
      .from("credit_purchases")
      .update({
        status: "completed",
        polar_subscription_id: opts.polarSubscriptionId ?? null,
      })
      .eq("id", existing.id);
    return;
  }

  // Try to match the original pending checkout row, otherwise create a fresh one
  // (subscription renewals: there is no client-side checkout to match).
  let purchaseId: string | null = null;
  if (opts.polarCheckoutId) {
    const { data: pending } = await supabaseAdmin
      .from("credit_purchases")
      .select("id")
      .eq("polar_checkout_id", opts.polarCheckoutId)
      .maybeSingle();
    purchaseId = pending?.id ?? null;
  }

  if (purchaseId) {
    await supabaseAdmin
      .from("credit_purchases")
      .update({
        polar_order_id: opts.polarOrderId,
        polar_subscription_id: opts.polarSubscriptionId ?? null,
      })
      .eq("id", purchaseId);
  } else {
    await supabaseAdmin.from("credit_purchases").insert({
      user_id: opts.userId,
      amount_usd: opts.amountUsd,
      credits_added: opts.credits,
      status: "pending",
      kind: opts.kind,
      polar_order_id: opts.polarOrderId,
      polar_subscription_id: opts.polarSubscriptionId ?? null,
    });
  }

  const { error: rpcErr } = await supabaseAdmin.rpc("add_credits", {
    _user_id: opts.userId,
    _amount: opts.credits,
  });
  if (rpcErr) throw new Error(rpcErr.message);

  await supabaseAdmin
    .from("credit_purchases")
    .update({ status: "completed" })
    .eq("polar_order_id", opts.polarOrderId);
}

async function userIdForCustomer(
  externalCustomerId: string | null | undefined,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (externalCustomerId) return externalCustomerId;
  if (!customerId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("polar_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

export const Route = createFileRoute("/api/public/polar-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        let event: { type: string; data: Record<string, unknown> };
        try {
          event = verify(body, request.headers);
        } catch (e) {
          console.error("Polar webhook signature failed", e);
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const d = event.data as Record<string, unknown>;

          // Always link customer when we can.
          const externalCustomerId =
            (d.customer as { external_id?: string } | undefined)?.external_id ??
            (d.metadata as { user_id?: string } | undefined)?.user_id ??
            null;
          const customerId =
            (d.customer as { id?: string } | undefined)?.id ??
            (d.customer_id as string | undefined) ??
            null;

          if (externalCustomerId && customerId) {
            await supabaseAdmin
              .from("profiles")
              .update({ polar_customer_id: customerId })
              .eq("id", externalCustomerId);
          }

          switch (event.type) {
            case "order.paid":
            case "order.created": {
              if (event.type === "order.created" && (d.status as string) !== "paid") break;
              const userId = await userIdForCustomer(externalCustomerId, customerId);
              if (!userId) break;
              const productId = (d.product_id as string) ?? null;
              const product = [...POLAR_CATALOG.topup, ...POLAR_CATALOG.autoTopup].find(
                (p) => p.id === productId,
              );
              if (!product) break;
              const subId = (d.subscription_id as string | undefined) ?? null;
              const kind = subId ? "auto_topup_cycle" : "topup";
              await creditUser({
                userId,
                credits: product.credits,
                amountUsd: product.price,
                polarOrderId: d.id as string,
                polarCheckoutId: (d.checkout_id as string | undefined) ?? null,
                polarSubscriptionId: subId,
                kind,
              });
              break;
            }
            case "subscription.created":
            case "subscription.active": {
              const userId = await userIdForCustomer(externalCustomerId, customerId);
              if (!userId) break;
              await supabaseAdmin
                .from("profiles")
                .update({
                  auto_topup_active: true,
                  auto_topup_subscription_id: d.id as string,
                  auto_topup_product_id: (d.product_id as string) ?? null,
                })
                .eq("id", userId);
              break;
            }
            case "subscription.canceled":
            case "subscription.revoked": {
              const userId = await userIdForCustomer(externalCustomerId, customerId);
              if (!userId) break;
              await supabaseAdmin
                .from("profiles")
                .update({
                  auto_topup_active: false,
                  auto_topup_subscription_id: null,
                  auto_topup_product_id: null,
                })
                .eq("id", userId);
              break;
            }
            default:
              break;
          }
        } catch (e) {
          console.error("Polar webhook handler error", e);
          // Still ack so Polar doesn't retry-storm; we have logs.
        }

        return new Response("ok");
      },
    },
  },
});