import { createFileRoute } from "@tanstack/react-router";
import { validateApiKeyHeader } from "@/lib/api/auth";
import { checkDestinationSafety } from "@/lib/api/safety";
import { holdBalanceForCallTask } from "@/lib/api/holds";
import { dispatchWebhookEvent } from "@/lib/api/webhooks";
import { recordApiAuditLog } from "@/lib/api/audit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRateForNumber } from "@/lib/rates";

export const Route = createFileRoute("/api/v1/calls")({
  server: {
    handlers: {
      // POST /api/v1/calls - Create a new agent call task
      POST: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          await recordApiAuditLog({ request, statusCode: auth.statusCode || 401 });
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id, key, is_test } = auth.context;

        // Rate limiting
        const rateCheck = checkRateLimit(key.id);
        if (!rateCheck.allowed) {
          await recordApiAuditLog({ userId: user_id, apiKeyId: key.id, request, statusCode: 429 });
          return Response.json(
            { error: "Too many requests. Please slow down." },
            { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          await recordApiAuditLog({ userId: user_id, apiKeyId: key.id, request, statusCode: 400 });
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const {
          to,
          from,
          mode = "assisted",
          goal,
          script,
          notes,
          context = {},
          metadata = {},
          scheduled_for,
          destination_timezone,
          max_duration_seconds = 900,
          consent_attestation,
        } = body;

        if (!to || typeof to !== "string") {
          return Response.json({ error: "Field 'to' phone number is required" }, { status: 400 });
        }

        // Mandatory legal consent attestation
        if (consent_attestation !== true) {
          return Response.json(
            {
              error:
                "Field 'consent_attestation' must be true. Caller must certify lawful basis and consent to place this call.",
            },
            { status: 400 }
          );
        }

        // Safety & denylist check
        const safety = await checkDestinationSafety({
          userId: user_id,
          toNumber: to,
          isTest: is_test,
        });

        if (!safety.allowed) {
          await recordApiAuditLog({ userId: user_id, apiKeyId: key.id, request, statusCode: safety.statusCode || 400 });
          return Response.json({ error: safety.reason }, { status: safety.statusCode || 400 });
        }

        // Calculate rate & hold
        const rateInfo = getRateForNumber(to);
        const ratePerMinute = rateInfo.rate;
        const estimatedCost = Math.round((max_duration_seconds / 60) * ratePerMinute * 10000) / 10000;

        // Parse scheduled time if provided
        let scheduledDate: string | null = null;
        let initialStatus = "awaiting_human"; // default for assisted mode

        if (scheduled_for) {
          const parsed = new Date(scheduled_for);
          if (isNaN(parsed.getTime())) {
            return Response.json({ error: "Invalid 'scheduled_for' timestamp" }, { status: 400 });
          }
          if (parsed.getTime() > Date.now()) {
            scheduledDate = parsed.toISOString();
            initialStatus = "queued";
          }
        }

        // Insert call task
        const { data: task, error: insertErr } = await supabaseAdmin
          .from("call_tasks")
          .insert({
            user_id,
            api_key_id: key.id,
            to_number: to,
            from_number: from ?? null,
            country_code: rateInfo.country ?? null,
            mode,
            status: initialStatus,
            goal: goal ?? null,
            script: script ?? null,
            notes: notes ?? null,
            context,
            metadata,
            consent_attestation: true,
            scheduled_for: scheduledDate,
            destination_timezone: destination_timezone ?? null,
            rate_per_minute: ratePerMinute,
            max_duration_seconds,
            is_test,
          })
          .select("*")
          .single();

        if (insertErr || !task) {
          return Response.json({ error: insertErr?.message || "Failed to create call task" }, { status: 500 });
        }

        // Atomic balance hold
        const hold = await holdBalanceForCallTask({
          userId: user_id,
          taskId: task.id,
          estimatedCost,
          isTest: is_test,
        });

        if (!hold.ok) {
          // Rollback task status
          await supabaseAdmin.from("call_tasks").update({ status: "failed" }).eq("id", task.id);
          return Response.json({ error: hold.error }, { status: 402 });
        }

        // Dispatch webhook
        await dispatchWebhookEvent({
          userId: user_id,
          event: initialStatus === "queued" ? "call.queued" : "call.awaiting_human",
          data: task,
          isTest: is_test,
        });

        await recordApiAuditLog({ userId: user_id, apiKeyId: key.id, request, statusCode: 201 });

        return Response.json(
          {
            id: task.id,
            to: task.to_number,
            from: task.from_number,
            mode: task.mode,
            status: task.status,
            rate_per_minute: task.rate_per_minute,
            estimated_cost: estimatedCost,
            scheduled_for: task.scheduled_for,
            destination_timezone: task.destination_timezone,
            created_at: task.created_at,
            is_test: task.is_test,
          },
          { status: 201 }
        );
      },

      // GET /api/v1/calls - List agent call tasks with cursor pagination
      GET: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id, is_test } = auth.context;
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);
        const status = url.searchParams.get("status");

        let query = supabaseAdmin
          .from("call_tasks")
          .select("*")
          .eq("user_id", user_id)
          .eq("is_test", is_test)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq("status", status);
        }

        const { data: tasks, error } = await query;
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ data: tasks ?? [] });
      },
    },
  },
});
