import { createFileRoute } from "@tanstack/react-router";
import { validateApiKeyHeader } from "@/lib/api/auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id, key, is_test } = auth.context;

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, credit_balance, account_approval_status, business_name")
          .eq("id", user_id)
          .maybeSingle();

        const { data: limits } = await supabaseAdmin
          .from("account_limits")
          .select("*")
          .eq("user_id", user_id)
          .maybeSingle();

        return Response.json({
          account_id: user_id,
          email: profile?.email,
          approval_status: profile?.account_approval_status ?? "approved",
          business_name: profile?.business_name,
          key: {
            id: key.id,
            name: key.name,
            mode: key.mode,
            prefix: key.key_prefix,
            scopes: key.scopes,
          },
          limits: {
            daily_spend_cap: limits?.daily_spend_cap ?? 50.0,
            daily_call_cap: limits?.daily_call_cap ?? 100,
            max_call_duration_seconds: limits?.max_call_duration_seconds ?? 1800,
            is_killed: limits?.is_killed ?? false,
          },
          is_test,
        });
      },
    },
  },
});
