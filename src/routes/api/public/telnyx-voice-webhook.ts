import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;

export const Route = createFileRoute("/api/public/telnyx-voice-webhook")({
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
        const eventType: string = ev?.event_type;
        const callControlId: string | undefined = ev?.payload?.call_control_id;
        const clientState: string | undefined = ev?.payload?.client_state;

        console.log(`[Telnyx Voice Webhook] ${eventType} (control_id: ${callControlId})`);

        if (!callControlId || !TELNYX_API_KEY) {
          return new Response("ok");
        }

        // When recipient answers the phone call
        if (eventType === "call.answered") {
          let taskId: string | null = null;
          let textToSpeak = "Hello! This is an automated call dispatched by AgentCall.";

          if (clientState) {
            try {
              const decoded = JSON.parse(Buffer.from(clientState, "base64").toString("utf-8"));
              taskId = decoded.taskId;
              if (decoded.script) textToSpeak = decoded.script;
              else if (decoded.goal) textToSpeak = `Hello, this call was placed by an AI agent regarding: ${decoded.goal}`;
            } catch (e) {
              console.warn("Could not parse client_state:", e);
            }
          }

          // Trigger Text-to-Speech speaking on the active phone line
          await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payload: textToSpeak,
              voice: "female",
              language: "en-US",
            }),
          }).catch((err) => console.error("Speak action failed:", err));

          if (taskId) {
            await supabaseAdmin
              .from("call_tasks")
              .update({ status: "in_progress", updated_at: new Date().toISOString() })
              .eq("id", taskId);
          }
        }

        // When call completes or hangs up
        if (eventType === "call.hangup") {
          let taskId: string | null = null;
          if (clientState) {
            try {
              const decoded = JSON.parse(Buffer.from(clientState, "base64").toString("utf-8"));
              taskId = decoded.taskId;
            } catch (e) {}
          }

          if (taskId) {
            await supabaseAdmin
              .from("call_tasks")
              .update({ status: "completed", updated_at: new Date().toISOString() })
              .eq("id", taskId);
          }
        }

        return new Response("ok");
      },
      GET: async () => new Response("ok"),
    },
  },
});
