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

const TELNYX_BASE = "https://api.telnyx.com/v2";

function telnyxKey() {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("TELNYX_API_KEY is not configured on the server.");
  return key;
}

export const searchAvailableNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { country: string; areaCode?: string; limit?: number }) => input,
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    params.set("filter[country_code]", data.country.toUpperCase());
    params.set("filter[features][]", "voice");
    params.set("filter[limit]", String(Math.min(data.limit ?? 20, 30)));
    params.set("filter[best_effort]", "false");
    if (data.areaCode && data.areaCode.trim() !== "") {
      params.set("filter[national_destination_code]", data.areaCode.trim());
    }

    const res = await fetch(
      `${TELNYX_BASE}/available_phone_numbers?${params.toString()}`,
      { headers: { Authorization: `Bearer ${telnyxKey()}` } },
    );
    const json = (await res.json()) as {
      data?: Array<{
        phone_number: string;
        region_information?: Array<{ region_type: string; region_name: string }>;
        cost_information?: { monthly_cost?: string; currency?: string };
      }>;
      errors?: Array<{ detail?: string; title?: string }>;
    };
    if (!res.ok) {
      const detail = json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Telnyx ${res.status}`;
      throw new Error(detail);
    }
    return {
      numbers: (json.data ?? []).map((n) => ({
        phone_number: n.phone_number,
        monthly_cost: Number(n.cost_information?.monthly_cost ?? 1.95),
        currency: n.cost_information?.currency ?? "USD",
        region:
          n.region_information?.find((r) => r.region_type === "rate_center")?.region_name ??
          n.region_information?.[0]?.region_name ??
          null,
      })),
    };
  });

export const purchasePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string; country?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    const balance = Number(profile?.credit_balance ?? 0);
    const cost = 1.95;
    if (balance < cost) {
      throw new Error(
        `Insufficient credits. You need at least $${cost.toFixed(2)} to buy this number.`,
      );
    }

    const res = await fetch(`${TELNYX_BASE}/number_orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_numbers: [{ phone_number: data.phoneNumber }],
      }),
    });
    const json = (await res.json()) as {
      data?: { id?: string; phone_numbers?: Array<{ id?: string; phone_number?: string }> };
      errors?: Array<{ detail?: string; title?: string }>;
    };
    if (!res.ok) {
      const detail = json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Telnyx ${res.status}`;
      throw new Error(detail);
    }

    const orderId = json.data?.id ?? null;
    const numberId = json.data?.phone_numbers?.[0]?.id ?? null;

    const { error: deductErr } = await supabase.rpc("deduct_credits", {
      _user_id: userId,
      _amount: cost,
    });
    if (deductErr) throw new Error(deductErr.message);

    const { error: insertErr } = await supabase.from("phone_numbers").insert({
      user_id: userId,
      phone_number: data.phoneNumber,
      country_code: data.country?.toUpperCase() ?? null,
      monthly_cost: cost,
      telnyx_order_id: orderId,
      telnyx_number_id: numberId,
    });
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true, phoneNumber: data.phoneNumber };
  });

export const listMyPhoneNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id,phone_number,country_code,monthly_cost,status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { numbers: data ?? [] };
  });

export const listMyMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("messages")
      .select("id,to_number,from_number,body,direction,status,created_at,read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const sendSms = createServerFn({ method: "POST" })
  .inputValidator((data: { from: string; to: string; body: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the user owns the "from" number
    const { data: own, error: ownErr } = await supabase
      .from("phone_numbers")
      .select("id")
      .eq("user_id", userId)
      .eq("phone_number", data.from)
      .maybeSingle();
    if (ownErr) throw new Error(ownErr.message);
    if (!own) throw new Error("You do not own that sender number.");

    const res = await fetch(`${TELNYX_BASE}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: data.from, to: data.to, text: data.body }),
    });
    const json = (await res.json()) as {
      data?: { id?: string };
      errors?: Array<{ detail?: string; title?: string }>;
    };
    if (!res.ok) {
      const detail = json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Telnyx ${res.status}`;
      throw new Error(detail);
    }

    await supabase.from("messages").insert({
      user_id: userId,
      from_number: data.from,
      to_number: data.to,
      body: data.body,
      direction: "outbound",
      status: "sent",
      telnyx_message_id: json.data?.id ?? null,
    });

    return { ok: true };
  });