import { supabase } from "@/integrations/supabase/client";
import { getTelnyxWebrtcCredentials } from "@/lib/telnyx.functions";

export async function getWebrtcCredentials() {
  // Credentials are server-only secrets. Mint via a server function so we
 // never ship them to the browser bundle.
  return await getTelnyxWebrtcCredentials();
}

export async function startCallRecord(input: {
  to_number: string;
  country_code: string | null;
  rate_per_minute: number;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("calls")
    .insert({
      user_id: user.id,
      to_number: input.to_number,
      country_code: input.country_code,
      rate_per_minute: input.rate_per_minute,
      status: "initiated",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function finalizeCallRecord(input: {
  call_id: string;
  duration_seconds: number;
  status: "completed" | "failed" | "no_answer";
}) {
  const { data: call, error: fetchErr } = await supabase
    .from("calls")
    .select("id, user_id, rate_per_minute")
    .eq("id", input.call_id)
    .maybeSingle();
  if (fetchErr || !call) throw new Error("Call not found");

  const rate = Number(call.rate_per_minute ?? 0);
  const cost =
    Math.round((input.duration_seconds / 60) * rate * 10000) / 10000;

  const { error: updErr } = await supabase
    .from("calls")
    .update({
      duration_seconds: input.duration_seconds,
      cost,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", call.id);
  if (updErr) throw new Error(updErr.message);

  if (cost > 0) {
    await supabase.rpc("deduct_credits", {
      _user_id: call.user_id,
      _amount: cost,
    });
  }
  return { cost };
}