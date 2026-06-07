import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TEST_CREDIT_EMAIL = "prajwalshindeee@gmail.com";
const TEST_CREDIT_AMOUNT = 20;

function parseCreditBalance(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export const getCreditBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const select = "id, email, credit_balance";
    const userId = context.userId;

    const { data, error } = await context.supabase
      .from("profiles")
      .select(select)
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return {
      balance: data ? parseCreditBalance(data.credit_balance) : null,
      profileFound: Boolean(data),
      userId,
    };
  });

export const grantTestCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email =
      typeof context.claims.email === "string" ? context.claims.email.toLowerCase() : "";

    if (email !== TEST_CREDIT_EMAIL) {
      throw new Error("Test credits are only enabled for this test account.");
    }

    const { data, error } = await supabaseAdmin.rpc("add_credits", {
      _user_id: context.userId,
      _amount: TEST_CREDIT_AMOUNT,
    });

    if (error) throw error;

    return {
      balance: parseCreditBalance(data),
      amount: TEST_CREDIT_AMOUNT,
      userId: context.userId,
    };
  });
