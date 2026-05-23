import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTelnyxWebrtcCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile || Number(profile.credit_balance) <= 0) {
      throw new Error("Insufficient credits. Please top up to make calls.");
    }

    const username = process.env.TELNYX_WEBRTC_USERNAME;
    const password = process.env.TELNYX_WEBRTC_PASSWORD;
    if (!username || !password) {
      throw new Error("Telnyx WebRTC credentials are not configured on the server.");
    }
    return { username, password };
  });