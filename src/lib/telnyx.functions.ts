import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type ForwardRecipient,
  parseForwardRecipients,
  serializeForwardRecipients,
  extractForwardPhoneNumbers,
} from "@/lib/forwarding";

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
      throw new Error("Voice calling credentials are not configured on the server.");
    }
    const publicCallerId =
      process.env.TELNYX_PUBLIC_CALLER_ID ??
      process.env.TELNYX_DEFAULT_CALLER_ID ??
      process.env.PUBLIC_CALLER_ID ??
      null;
    return { username, password, publicCallerId };
  });

const TELNYX_BASE = "https://api.telnyx.com/v2";

// Retail markup for phone numbers (covers our margin + payment fees).
// Wholesale Telnyx cost × NUMBER_PRICE_MARKUP = price shown / charged to user.
// e.g. wholesale $1.00 → user pays $1.95.
const NUMBER_PRICE_MARKUP = 1.95;

// Fallback price if Telnyx omits cost_information (rare for local US numbers).
const FALLBACK_WHOLESALE_USD = 1;

function telnyxKey() {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("Voice provider API key is not configured on the server.");
  return key;
}

// Fetch the wholesale monthly cost for a specific phone number directly from
// the Telnyx availability API. Used at purchase time so we charge the exact
// retail price for THIS number, not a hard-coded value.
async function fetchWholesalePrice(phoneNumber: string): Promise<number> {
  try {
    const params = new URLSearchParams();
    params.set("filter[phone_number]", phoneNumber);
    params.set("filter[limit]", "1");
    const res = await fetch(
      `${TELNYX_BASE}/available_phone_numbers?${params.toString()}`,
      { headers: { Authorization: `Bearer ${telnyxKey()}` } },
    );
    if (!res.ok) return FALLBACK_WHOLESALE_USD;
    const json = (await res.json()) as {
      data?: Array<{ cost_information?: { monthly_cost?: string } }>;
    };
    const cost = Number(json.data?.[0]?.cost_information?.monthly_cost);
    return Number.isFinite(cost) && cost > 0 ? cost : FALLBACK_WHOLESALE_USD;
  } catch {
    return FALLBACK_WHOLESALE_USD;
  }
}

type AvailablePhoneNumber = {
  phone_number: string;
  region_information?: Array<{ region_type: string; region_name: string }>;
  cost_information?: { monthly_cost?: string; currency?: string };
};

type AvailablePhoneNumbersResponse = {
  data?: AvailablePhoneNumber[];
  errors?: Array<{ detail?: string; title?: string }>;
};

async function fetchAvailableNumbers(input: {
  country: string;
  areaCode?: string | null;
  limit: number;
}) {
  const params = new URLSearchParams();
  params.set("filter[country_code]", input.country);
  params.set("filter[features][]", "voice");
  params.set("filter[limit]", String(input.limit));
  params.set("filter[best_effort]", "false");
  if (input.areaCode) {
    params.set("filter[national_destination_code]", input.areaCode);
  }

  const res = await fetch(`${TELNYX_BASE}/available_phone_numbers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${telnyxKey()}` },
  });
  const json = (await res.json()) as AvailablePhoneNumbersResponse;
  if (!res.ok) {
    const detail =
      json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Voice provider ${res.status}`;
    throw new Error(detail);
  }
  return json.data ?? [];
}

function mapAvailableNumbers(numbers: AvailablePhoneNumber[]) {
  return numbers.map((n) => {
    const wholesale = Number(n.cost_information?.monthly_cost ?? 1);
    return {
      phone_number: n.phone_number,
      // Retail price = 2x Telnyx wholesale price (built-in margin).
      monthly_cost: Math.round(wholesale * NUMBER_PRICE_MARKUP * 100) / 100,
      currency: n.cost_information?.currency ?? "USD",
      region:
        n.region_information?.find((r) => r.region_type === "rate_center")?.region_name ??
        n.region_information?.[0]?.region_name ??
        null,
    };
  });
}

export const searchAvailableNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { country: string; areaCode?: string; limit?: number }) => input)
  .handler(async ({ data }) => {
    const country = data.country.trim().toUpperCase();
    const areaCode = data.areaCode?.replace(/\D/g, "").trim() || null;
    const requestedLimit = Number(data.limit ?? 20);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 20, 1), 30);

    const exactMatches = await fetchAvailableNumbers({ country, areaCode, limit });
    if (exactMatches.length > 0 || !areaCode) {
      return {
        numbers: mapAvailableNumbers(exactMatches),
        relaxedAreaCode: false,
        requestedAreaCode: areaCode,
      };
    }

    const countryWideMatches = await fetchAvailableNumbers({ country, areaCode: null, limit });
    return {
      numbers: mapAvailableNumbers(countryWideMatches),
      relaxedAreaCode: countryWideMatches.length > 0,
      requestedAreaCode: areaCode,
    };
  });

/**
 * @deprecated The credit-based purchase flow has been replaced by the Razorpay
 * checkout flow in `razorpay.functions.ts` (`createNumberOrder` +
 * `verifyAndProvisionNumber`). Kept here only so older clients don't break;
 * remove once nothing references it.
 */
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

    // Pull current wholesale price from Telnyx and apply our markup so the
    // user is charged exactly what was shown in the search results.
    const wholesale = await fetchWholesalePrice(data.phoneNumber);
    const cost = Math.round(wholesale * NUMBER_PRICE_MARKUP * 100) / 100;
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
      const detail =
        json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Voice provider ${res.status}`;
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

// Release a phone number — deletes it from Telnyx (so the user stops being
// billed) AND removes it from our DB. Best-effort on the Telnyx side so a
// stale/already-released number can still be cleaned up locally.
export const releasePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: fetchErr } = await supabase
      .from("phone_numbers")
      .select("id, telnyx_number_id, phone_number")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Number not found");

    if (row.telnyx_number_id) {
      try {
        await fetch(`${TELNYX_BASE}/phone_numbers/${row.telnyx_number_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${telnyxKey()}` },
        });
      } catch (e) {
        console.warn("telnyx number delete failed", e);
      }
    }

    const { error: delErr } = await supabase
      .from("phone_numbers")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const listMyPhoneNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id,phone_number,country_code,monthly_cost,status,forward_to_number,forward_sms_enabled,created_at")
      .eq("user_id", userId)
      // Hide rows that are still awaiting payment — they're not yet owned.
      .neq("status", "pending_payment")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { numbers: data ?? [] };
  });

export {
  normalizeE164,
  parseForwardRecipients,
  parseForwardConfig,
  serializeForwardRecipients,
  extractForwardPhoneNumbers,
  type ForwardRecipient,
  type ForwardConfig,
  type ForwardMode,
} from "@/lib/forwarding";

export function parseAndNormalizePhoneList(input: unknown): string[] {
  return extractForwardPhoneNumbers(input as string);
}

export const updatePhoneNumberForwarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      forward_to_number?: string | null;
      forward_to_numbers?: string[];
      recipients?: Array<{ number: string; name?: string }>;
      mode?: "both" | "receive";
      forward_sms_enabled: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let targetRecipients: ForwardRecipient[] = [];

    if (Array.isArray(data.recipients)) {
      targetRecipients = data.recipients.map((r) => ({
        number: normalizeE164(r.number),
        name: (r.name || "").trim(),
      }));
    } else if (Array.isArray(data.forward_to_numbers)) {
      targetRecipients = data.forward_to_numbers.map((n) => ({
        number: normalizeE164(n),
        name: "",
      }));
    } else if (data.forward_to_number && data.forward_to_number.trim()) {
      targetRecipients = parseForwardRecipients(data.forward_to_number);
    }

    const seen = new Set<string>();
    const normalizedRecipients: ForwardRecipient[] = [];

    for (const r of targetRecipients) {
      if (!/^\+\d{7,16}$/.test(r.number)) {
        throw new Error(
          `Invalid phone number format "${r.number}". Please include country code, e.g. +91 8605222604 or +1 415 555 2671.`,
        );
      }
      if (!seen.has(r.number)) {
        seen.add(r.number);
        normalizedRecipients.push(r);
      }
    }

    if (data.forward_sms_enabled && normalizedRecipients.length === 0) {
      throw new Error(
        "Please add at least one forwarding phone number before enabling auto-forwarding.",
      );
    }

    const forwardMode = data.mode ?? "both";
    const serialized = serializeForwardRecipients(normalizedRecipients, forwardMode);

    const { error } = await supabase
      .from("phone_numbers")
      .update({
        forward_to_number: serialized,
        forward_sms_enabled: data.forward_sms_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return {
      ok: true,
      forward_to_number: serialized,
      recipients: normalizedRecipients,
      forward_to_numbers: normalizedRecipients.map((r) => r.number),
      mode: forwardMode,
      forward_sms_enabled: data.forward_sms_enabled,
    };
  });

export const sendTestForwardingSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumberId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: num, error: numErr } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, forward_to_number, forward_sms_enabled")
      .eq("id", data.phoneNumberId)
      .eq("user_id", userId)
      .maybeSingle();

    if (numErr) throw new Error(numErr.message);
    if (!num) throw new Error("Phone number not found.");

    const recipients = parseForwardRecipients(num.forward_to_number);
    if (recipients.length === 0) {
      throw new Error("No forwarding recipients configured. Please add at least one recipient first.");
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const testBody = `[Ringringa Test SMS]: Auto-forwarding is verified and working live for your number ${num.phone_number}! (${timeStr})`;

    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const toE164 = r.number;
        let sender = toE164.startsWith("+91") ? "Ringringa" : num.phone_number;

        let res = await fetch(`${TELNYX_BASE}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${telnyxKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender,
            to: toE164,
            text: testBody,
            messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
          }),
        });

        if (!res.ok && sender !== "Ringringa") {
          res = await fetch(`${TELNYX_BASE}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${telnyxKey()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Ringringa",
              to: toE164,
              text: testBody,
              messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
            }),
          });
        }

        const json = (await res.json()) as { data?: { id?: string }; errors?: Array<{ detail?: string }> };
        if (!res.ok) {
          throw new Error(json.errors?.[0]?.detail ?? `Telnyx error ${res.status}`);
        }

        await supabase.from("messages").insert({
          user_id: userId,
          from_number: num.phone_number,
          to_number: toE164,
          body: testBody,
          direction: "outbound",
          status: "forwarded",
          telnyx_message_id: json.data?.id ?? null,
        });

        return toE164;
      }),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");

    if (succeeded === 0 && failed.length > 0) {
      throw new Error((failed[0] as PromiseRejectedResult).reason?.message ?? "Test dispatch failed.");
    }

    return {
      ok: true,
      succeeded,
      total: recipients.length,
      recipients: recipients.map((r) => ({ number: r.number, name: r.name || "" })),
    };
  });

export const forwardSmsMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string | string[]; body: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership of sender number
    const { data: own, error: ownErr } = await supabase
      .from("phone_numbers")
      .select("id")
      .eq("user_id", userId)
      .eq("phone_number", data.from)
      .maybeSingle();
    if (ownErr) throw new Error(ownErr.message);
    if (!own) throw new Error("You do not own that sender number.");

    const rawRecipients = Array.isArray(data.to)
      ? data.to
      : String(data.to).split(/[,;\n\r]+/);
    const recipients: string[] = [];
    const seen = new Set<string>();

    for (const r of rawRecipients) {
      const trimmed = r.trim();
      if (!trimmed) continue;
      const normalized = normalizeE164(trimmed);
      if (!/^\+\d{7,16}$/.test(normalized)) {
        throw new Error(`Invalid recipient phone number "${trimmed}". Use international format with country code.`);
      }
      if (!seen.has(normalized)) {
        seen.add(normalized);
        recipients.push(normalized);
      }
    }

    if (recipients.length === 0) {
      throw new Error("Please specify at least one recipient phone number.");
    }

    const results = await Promise.allSettled(
      recipients.map(async (toE164) => {
        let sender = toE164.startsWith("+91") ? "Ringringa" : data.from;

        let res = await fetch(`${TELNYX_BASE}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${telnyxKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender,
            to: toE164,
            text: data.body,
            messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
          }),
        });

        // Retry with alpha sender if numeric fails
        if (!res.ok && sender !== "Ringringa") {
          res = await fetch(`${TELNYX_BASE}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${telnyxKey()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Ringringa",
              to: toE164,
              text: data.body,
              messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
            }),
          });
        }

        const json = (await res.json()) as {
          data?: { id?: string };
          errors?: Array<{ detail?: string; title?: string }>;
        };
        if (!res.ok) {
          const detail =
            json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Voice provider ${res.status}`;
          throw new Error(detail);
        }

        await supabase.from("messages").insert({
          user_id: userId,
          from_number: data.from,
          to_number: toE164,
          body: data.body,
          direction: "outbound",
          status: "forwarded",
          telnyx_message_id: json.data?.id ?? null,
        });

        return toE164;
      }),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");

    if (succeeded === 0 && failed.length > 0) {
      const firstError = (failed[0] as PromiseRejectedResult).reason;
      throw new Error(firstError?.message ?? "Failed to forward message.");
    }

    return { ok: true, succeeded, total: recipients.length };
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
      .select("id, forward_sms_enabled, forward_to_number")
      .eq("user_id", userId)
      .eq("phone_number", data.from)
      .maybeSingle();
    if (ownErr) throw new Error(ownErr.message);
    if (!own) throw new Error("You do not own that sender number.");

    let sender = data.to.startsWith("+91") ? "Ringringa" : data.from;

    let res = await fetch(`${TELNYX_BASE}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: data.to,
        text: data.body,
        messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
      }),
    });

    if (!res.ok && sender !== "Ringringa") {
      res = await fetch(`${TELNYX_BASE}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${telnyxKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Ringringa",
          to: data.to,
          text: data.body,
          messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
        }),
      });
    }
    const json = (await res.json()) as {
      data?: { id?: string };
      errors?: Array<{ detail?: string; title?: string }>;
    };
    if (!res.ok) {
      const detail =
        json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Voice provider ${res.status}`;
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

    // If auto-forwarding is enabled and configured for "both" send & receive, forward outgoing copy
    if (own.forward_sms_enabled && own.forward_to_number) {
      try {
        const config = parseForwardConfig(own.forward_to_number);
        if (config.mode === "both" && config.recipients.length > 0) {
          const fwdText = `[Sent to ${data.to}]: ${data.body}`;
          await Promise.allSettled(
            config.recipients.map(async (r) => {
              const target = r.number;
              const fwdSender = target.startsWith("+91") ? "Ringringa" : data.from;
              let fwdRes = await fetch(`${TELNYX_BASE}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${telnyxKey()}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: fwdSender,
                  to: target,
                  text: fwdText,
                  messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
                }),
              });
              if (!fwdRes.ok && fwdSender !== "Ringringa") {
                fwdRes = await fetch(`${TELNYX_BASE}/messages`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${telnyxKey()}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Ringringa",
                    to: target,
                    text: fwdText,
                    messaging_profile_id: "4001a146-07f5-42a5-886b-50ca50fe578b",
                  }),
                });
              }
              const fwdJson = (await fwdRes.json()) as { data?: { id?: string } };
              await supabase.from("messages").insert({
                user_id: userId,
                from_number: data.from,
                to_number: target,
                body: fwdText,
                direction: "outbound",
                status: "forwarded",
                telnyx_message_id: fwdJson?.data?.id ?? null,
              });
            }),
          );
        }
      } catch (fwdErr) {
        console.error("Failed to forward outgoing SMS copy:", fwdErr);
      }
    }

    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Verified Caller IDs (Telnyx "Verified Numbers" API)
// ────────────────────────────────────────────────────────────────────────────

export const initiateCallerIdVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { phone: string; method?: "sms" | "call" }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const phone = normalizeE164(data.phone);
    if (!/^\+\d{8,15}$/.test(phone)) {
      throw new Error("Enter a valid number in international format, e.g. +14155551234");
    }
    const verificationMethod = data.method === "call" ? "call" : "sms";

    const res = await fetch(`${TELNYX_BASE}/verified_numbers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phone,
        verification_method: verificationMethod,
      }),
    });
    const json = (await res.json()) as {
      data?: { id?: string; phone_number?: string };
      errors?: Array<{ detail?: string; title?: string; code?: string }>;
    };
    if (!res.ok) {
      const detail =
        json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Voice provider ${res.status}`;
      throw new Error(detail);
    }

    await supabase
      .from("verified_caller_ids")
      .upsert(
        {
          user_id: userId,
          phone_number: phone,
          status: "pending",
          telnyx_id: json.data?.id ?? null,
        },
        { onConflict: "user_id,phone_number" },
      );

    return { ok: true, phone, method: verificationMethod };
  });

export const confirmCallerIdVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string; code: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const phone = normalizeE164(data.phone);
    const code = data.code.trim().replace(/\D/g, "");
    if (!code) throw new Error("Enter the verification code you received.");

    const res = await fetch(
      `${TELNYX_BASE}/verified_numbers/${encodeURIComponent(phone)}/actions/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${telnyxKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verification_code: code }),
      },
    );
    const json = (await res.json()) as {
      data?: unknown;
      errors?: Array<{ detail?: string; title?: string }>;
    };
    if (!res.ok) {
      const detail =
        json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Voice provider ${res.status}`;
      throw new Error(detail);
    }

    const { error: updErr } = await supabase
      .from("verified_caller_ids")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("phone_number", phone);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, phone };
  });

export const listVerifiedCallerIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("verified_caller_ids")
      .select("id,phone_number,status,verified_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { numbers: data ?? [] };
  });

export const removeVerifiedCallerId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const phone = normalizeE164(data.phone);

    // Best-effort: remove from Telnyx (ignore failure — number may already be gone).
    try {
      await fetch(`${TELNYX_BASE}/verified_numbers/${encodeURIComponent(phone)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${telnyxKey()}` },
      });
    } catch {}

    const { error } = await supabase
      .from("verified_caller_ids")
      .delete()
      .eq("user_id", userId)
      .eq("phone_number", phone);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
