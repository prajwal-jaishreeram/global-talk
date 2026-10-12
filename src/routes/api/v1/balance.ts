import { createFileRoute } from "@tanstack/react-router";
import { validateApiKeyHeader } from "@/lib/api/auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/balance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const { user_id, is_test } = auth.context;

        if (is_test) {
          return Response.json({
            credit_balance: 100.0,
            active_holds: 0.0,
            available_balance: 100.0,
            currency: "USD",
            is_test: true,
          });
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credit_balance")
          .eq("id", user_id)
          .maybeSingle();

        const { data: holds } = await supabaseAdmin
          .from("balance_holds")
          .select("held_amount")
          .eq("user_id", user_id)
          .eq("status", "active");

        const totalHolds = (holds ?? []).reduce((acc, h) => acc + Number(h.held_amount), 0);
        const creditBalance = Number(profile?.credit_balance ?? 0);
        const availableBalance = Math.max(0, creditBalance - totalHolds);

        return Response.json({
          credit_balance: creditBalance,
          active_holds: totalHolds,
          available_balance: availableBalance,
          currency: "USD",
          is_test: false,
        });
      },
    },
  },
});
