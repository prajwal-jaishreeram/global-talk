import { createFileRoute } from "@tanstack/react-router";
import { validateApiKeyHeader } from "@/lib/api/auth";
import { releaseBalanceForCallTask } from "@/lib/api/holds";
import { dispatchWebhookEvent } from "@/lib/api/webhooks";
import { recordApiAuditLog } from "@/lib/api/audit";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/calls/$id")({
  server: {
    handlers: {
      // GET /api/v1/calls/:id - Get specific call status
      GET: async ({ request, params }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id } = auth.context;
        const { id } = params;

        const { data: task, error } = await supabaseAdmin
          .from("call_tasks")
          .select("*, call_attempts(*)")
          .eq("id", id)
          .eq("user_id", user_id)
          .maybeSingle();

        if (error || !task) {
          return Response.json({ error: "Call not found" }, { status: 404 });
        }

        return Response.json({ data: task });
      },

      // POST /api/v1/calls/:id/cancel - Cancel pending or scheduled call
      POST: async ({ request, params }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id, is_test } = auth.context;
        const { id } = params;

        const url = new URL(request.url);
        const isCancelAction = url.pathname.endsWith("/cancel");

        const { data: task } = await supabaseAdmin
          .from("call_tasks")
          .select("*")
          .eq("id", id)
          .eq("user_id", user_id)
          .maybeSingle();

        if (!task) {
          return Response.json({ error: "Call not found" }, { status: 404 });
        }

        if (isCancelAction || task.status === "queued" || task.status === "awaiting_human") {
          // Release balance hold
          await releaseBalanceForCallTask({ taskId: task.id, isTest: is_test });

          await supabaseAdmin
            .from("call_tasks")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("id", task.id);

          await dispatchWebhookEvent({
            userId: user_id,
            event: "call.canceled",
            data: { id: task.id, status: "canceled" },
            isTest: is_test,
          });

          return Response.json({ ok: true, status: "canceled" });
        }

        return Response.json({ error: `Cannot cancel call with status ${task.status}` }, { status: 400 });
      },
    },
  },
});
