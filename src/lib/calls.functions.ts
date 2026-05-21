import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getWebrtcCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const username = process.env.TELNYX_WEBRTC_USERNAME;
    const password = process.env.TELNYX_WEBRTC_PASSWORD;
    if (!username || !password) throw new Error("Telnyx credentials not configured");

    // Require some balance so we don't hand creds to empty accounts
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || Number(profile.credit_balance) <= 0) {
      throw new Error("Insufficient credits. Please top up to make calls.");
    }
    return { username, password };
  });

export const startCallRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      to_number: z.string().min(3).max(20),
      country_code: z.string().length(2).nullable(),
      rate_per_minute: z.number().min(0).max(10),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row, error } = await supabaseAdmin
      .from("calls")
      .insert({
        user_id: userId,
        to_number: data.to_number,
        country_code: data.country_code,
        rate_per_minute: data.rate_per_minute,
        status: "initiated",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const finalizeCallRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      call_id: z.string().uuid(),
      duration_seconds: z.number().int().min(0).max(60 * 60 * 6),
      status: z.enum(["completed", "failed", "no_answer"]),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: call, error: fetchErr } = await supabaseAdmin
      .from("calls")
      .select("id, user_id, rate_per_minute, duration_seconds, cost")
      .eq("id", data.call_id)
      .maybeSingle();
    if (fetchErr || !call) throw new Error("Call not found");
    if (call.user_id !== userId) throw new Error("Forbidden");

    const rate = Number(call.rate_per_minute ?? 0);
    const cost = Math.round((data.duration_seconds / 60) * rate * 10000) / 10000;

    const { error: updErr } = await supabaseAdmin
      .from("calls")
      .update({
        duration_seconds: data.duration_seconds,
        cost,
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", call.id);
    if (updErr) throw new Error(updErr.message);

    if (cost > 0) {
      await supabaseAdmin.rpc("deduct_credits", {
        _user_id: userId,
        _amount: cost,
      });
    }
    return { cost };
  });