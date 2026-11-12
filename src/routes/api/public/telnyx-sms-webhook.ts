import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRecipientsForEvent, extractOtpCode } from "@/lib/forwarding";

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
          .select("user_id, forward_to_number, forward_sms_enabled")
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

        // Auto-forward incoming message to all configured forwarding numbers if user enabled it
        if (owner.forward_sms_enabled && owner.forward_to_number) {
          const telnyxKey = process.env.TELNYX_API_KEY;
          if (telnyxKey) {
            const isOtp = Boolean(extractOtpCode(body));
            const forwardTargets = getRecipientsForEvent(owner.forward_to_number, "inbound", isOtp);

            const forwardText = `[Fwd from ${from}]: ${body}`;

            await Promise.allSettled(
              forwardTargets.map(async (targetNumber: string) => {
                try {
                  // For India (+91) and other international destinations requiring alphanumeric sender IDs, use "Ringringa".
                  // For domestic US/CA, use the owned number `to`.
                  let sender = targetNumber.startsWith("+91") ? "Ringringa" : to;

                  let fwdRes = await fetch("https://api.telnyx.com/v2/messages", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${telnyxKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: sender,
                      to: targetNumber,
                      text: forwardText,
                      messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
                    }),
                  });

                  // If standard numeric sender failed, retry with alphanumeric sender
                  if (!fwdRes.ok && sender !== "Ringringa") {
                    fwdRes = await fetch("https://api.telnyx.com/v2/messages", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${telnyxKey}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        from: "Ringringa",
                        to: targetNumber,
                        text: forwardText,
                        messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
                      }),
                    });
                  }

                  const fwdJson = (await fwdRes.json()) as { data?: { id?: string } };
                  await supabaseAdmin.from("messages").insert({
                    user_id: owner.user_id,
                    from_number: to,
                    to_number: targetNumber,
                    body: forwardText,
                    direction: "outbound",
                    status: "forwarded",
                    telnyx_message_id: fwdJson?.data?.id ?? null,
                  });
                } catch (fwdErr) {
                  console.error(
                    `[Telnyx SMS Webhook] auto-forward to ${targetNumber} failed:`,
                    fwdErr,
                  );
                }
              }),
            );
          }
        }

        return new Response("ok");
      },
      GET: async () => new Response("ok"),
    },
  },
});