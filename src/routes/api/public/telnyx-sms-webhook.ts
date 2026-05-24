import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/telnyx-sms-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const ev = payload?.data;
        const type: string | undefined = ev?.event_type;
        if (type !== "message.received") {
          // Acknowledge other events (e.g. message.sent, finalized) without storing.
          return new Response("ok");
        }

        const p = ev?.payload ?? {};
        const from: string | undefined = p?.from?.phone_number;
        const toEntry = Array.isArray(p?.to) ? p.to[0] : null;
        const to: string | undefined = toEntry?.phone_number;
        const body: string = typeof p?.text === "string" ? p.text : "";
        const telnyxId: string | undefined = p?.id;
        const media = Array.isArray(p?.media) ? p.media : null;

        if (!from || !to) return new Response("Missing from/to", { status: 400 });

        const { data: owner, error: ownerErr } = await supabaseAdmin
          .from("phone_numbers")
          .select("user_id")
          .eq("phone_number", to)
          .maybeSingle();
        if (ownerErr) return new Response(ownerErr.message, { status: 500 });
        if (!owner) return new Response("No owner for number", { status: 200 });

        const { error: insertErr } = await supabaseAdmin.from("messages").insert({
          user_id: owner.user_id,
          from_number: from,
          to_number: to,
          body,
          direction: "inbound",
          status: "received",
          telnyx_message_id: telnyxId ?? null,
          media_urls: media,
        });
        if (insertErr) return new Response(insertErr.message, { status: 500 });

        return new Response("ok");
      },
      GET: async () => new Response("ok"),
    },
  },
});