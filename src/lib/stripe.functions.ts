import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured yet. Add STRIPE_SECRET_KEY in project secrets to enable checkout.",
    );
  }
  return new Stripe(key);
}

function bonusPct(amount: number) {
  if (amount >= 100) return 0.1;
  if (amount >= 50) return 0.05;
  return 0;
}

export const createCreditsCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amountUsd: z.number().min(5).max(1000),
        promo: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const stripe = getStripe();
    const { userId } = context;
    const amount = Math.round(data.amountUsd * 100) / 100;
    const bonus = Math.round(amount * bonusPct(amount) * 100) / 100;
    const creditsAdded = amount + bonus;

    const host = getRequestHost();
    const proto = host.startsWith("localhost") ? "http" : "https";
    const origin = `${proto}://${host}`;

    // Record a pending purchase using the admin client (table denies user INSERTs).
    const { data: purchase, error: insErr } = await supabaseAdmin
      .from("credit_purchases")
      .insert({
        user_id: userId,
        amount_usd: amount,
        credits_added: creditsAdded,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !purchase) {
      throw new Error(insErr?.message ?? "Could not create purchase record");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: context.claims.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Eginta credits — $${creditsAdded.toFixed(2)}`,
              description: bonus
                ? `$${amount.toFixed(2)} purchase + $${bonus.toFixed(2)} bonus credits`
                : `$${amount.toFixed(2)} prepaid calling credits`,
            },
          },
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        purchase_id: purchase.id,
        user_id: userId,
        amount_usd: String(amount),
        credits_added: String(creditsAdded),
      },
      success_url: `${origin}/dashboard/credits?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/credits?purchase=cancelled`,
    });

    await supabaseAdmin
      .from("credit_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  });

export const confirmCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sessionId: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    if (session.payment_status !== "paid") {
      return { status: session.payment_status, credited: false };
    }
    const purchaseId = session.metadata?.purchase_id;
    if (!purchaseId) return { status: "paid", credited: false };

    const { data: purchase } = await supabaseAdmin
      .from("credit_purchases")
      .select("id, user_id, credits_added, status")
      .eq("id", purchaseId)
      .maybeSingle();
    if (!purchase || purchase.user_id !== context.userId) {
      return { status: "paid", credited: false };
    }
    if (purchase.status === "completed") {
      return { status: "paid", credited: true };
    }

    const { error: rpcErr } = await supabaseAdmin.rpc("add_credits", {
      _user_id: purchase.user_id,
      _amount: Number(purchase.credits_added),
    });
    if (rpcErr) throw new Error(rpcErr.message);

    await supabaseAdmin
      .from("credit_purchases")
      .update({
        status: "completed",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
      })
      .eq("id", purchase.id);

    return { status: "paid", credited: true };
  });