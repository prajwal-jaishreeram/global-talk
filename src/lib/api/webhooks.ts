import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface WebhookEventPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  is_test: boolean;
}

export function signWebhookPayload(secret: string, timestamp: string, payloadStr: string): string {
  const toSign = `${timestamp}.${payloadStr}`;
  return createHmac("sha256", secret).update(toSign).digest("hex");
}

export async function dispatchWebhookEvent(input: {
  userId: string;
  event: string;
  data: Record<string, unknown>;
  isTest: boolean;
}): Promise<void> {
  const { userId, event, data, isTest } = input;

  const { data: endpoints } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, url, secret, events, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!endpoints || endpoints.length === 0) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload: WebhookEventPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
    is_test: isTest,
  };
  const payloadString = JSON.stringify(payload);

  for (const ep of endpoints) {
    if (!ep.events || !ep.events.includes(event)) continue;

    const signature = signWebhookPayload(ep.secret, timestamp, payloadString);
    const signatureHeader = `t=${timestamp},v1=${signature}`;

    // Attempt delivery asynchronously
    (async () => {
      let statusCode: number | null = null;
      let errorMsg: string | null = null;
      let success = false;

      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "AgentCall-Signature": signatureHeader,
            "Ringringa-Signature": signatureHeader,
            "User-Agent": "AgentCall-Webhooks/1.0",
          },
          body: payloadString,
          signal: AbortSignal.timeout(6000),
        });
        statusCode = res.status;
        success = res.ok;
      } catch (err: any) {
        errorMsg = err?.message ?? "Network error";
      }

      await supabaseAdmin.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        user_id: userId,
        event_type: event,
        payload,
        status_code: statusCode,
        error_message: errorMsg,
        attempts: 1,
        delivered_at: success ? new Date().toISOString() : null,
        next_retry_at: success ? null : new Date(Date.now() + 60 * 1000).toISOString(),
      });
    })().catch((err) => console.warn("Failed to dispatch webhook:", err));
  }
}
