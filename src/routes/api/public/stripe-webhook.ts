import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.STRIPE_SECRET_KEY;
        const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!key || !whSecret) {
          return new Response("Stripe not configured", { status: 503 });
        }
        const stripe = new Stripe(key);
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const raw = await request.text();

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
        } catch (err) {
          return new Response(
            `Invalid signature: ${err instanceof Error ? err.message : "error"}`,
            { status: 400 },
          );
        }

        if (event.type !== "checkout.session.completed") {
          return new Response("ok");
        }

        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") return new Response("ok");

        const purchaseId = session.metadata?.purchase_id;
        if (!purchaseId) return new Response("ok");

        const { data: purchase } = await supabaseAdmin
          .from("credit_purchases")
          .select("id, user_id, credits_added, status")
          .eq("id", purchaseId)
          .maybeSingle();
        if (!purchase) return new Response("Purchase not found", { status: 404 });
        if (purchase.status === "completed") return new Response("ok");

        const { error: rpcErr } = await supabaseAdmin.rpc("add_credits", {
          _user_id: purchase.user_id,
          _amount: Number(purchase.credits_added),
        });
        if (rpcErr) return new Response(rpcErr.message, { status: 500 });

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

        return new Response("ok");
      },
      GET: async () => new Response("ok"),
    },
  },
});