import { createFileRoute } from "@tanstack/react-router";
import { validateApiKeyHeader } from "@/lib/api/auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes } from "node:crypto";

export const Route = createFileRoute("/api/v1/webhooks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id } = auth.context;
        const { data: endpoints } = await supabaseAdmin
          .from("webhook_endpoints")
          .select("id, url, events, is_active, created_at")
          .eq("user_id", user_id);

        return Response.json({ data: endpoints ?? [] });
      },

      POST: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id } = auth.context;
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { url, events = ["call.queued", "call.awaiting_human", "call.started", "call.completed", "call.failed", "call.canceled"] } = body;
        if (!url || !url.startsWith("http")) {
          return Response.json({ error: "A valid http/https url is required" }, { status: 400 });
        }

        const secret = `whsec_${randomBytes(24).toString("hex")}`;

        const { data: endpoint, error } = await supabaseAdmin
          .from("webhook_endpoints")
          .insert({
            user_id,
            url,
            secret,
            events,
            is_active: true,
          })
          .select("id, url, events, is_active, created_at")
          .single();

        if (error || !endpoint) {
          return Response.json({ error: error?.message || "Failed to create webhook" }, { status: 500 });
        }

        return Response.json({ data: { ...endpoint, secret } }, { status: 201 });
      },

      DELETE: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id } = auth.context;
        const url = new URL(request.url);
        const endpointId = url.searchParams.get("id");

        if (!endpointId) {
          return Response.json({ error: "Query parameter 'id' is required" }, { status: 400 });
        }

        await supabaseAdmin
          .from("webhook_endpoints")
          .delete()
          .eq("id", endpointId)
          .eq("user_id", user_id);

        return Response.json({ ok: true });
      },
    },
  },
});
