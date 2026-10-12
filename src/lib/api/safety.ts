import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  statusCode?: number;
}

export async function checkDestinationSafety(input: {
  userId: string;
  toNumber: string;
  isTest: boolean;
}): Promise<SafetyCheckResult> {
  const { userId, toNumber, isTest } = input;

  // Clean format
  const sanitized = toNumber.trim();

  // 1. Check Denylist Destinations
  const { data: denylist } = await supabaseAdmin
    .from("denylist_destinations")
    .select("pattern, reason")
    .eq("is_active", true);

  if (denylist && denylist.length > 0) {
    for (const item of denylist) {
      try {
        const regex = new RegExp(item.pattern);
        if (regex.test(sanitized)) {
          return {
            allowed: false,
            reason: `Destination is blocked by policy: ${item.reason}`,
            statusCode: 400,
          };
        }
      } catch {
        // Fallback prefix check if invalid regex
        if (sanitized.startsWith(item.pattern)) {
          return {
            allowed: false,
            reason: `Destination is blocked: ${item.reason}`,
            statusCode: 400,
          };
        }
      }
    }
  }

  // 2. Check Global Suppression List (Never-Call / DNC)
  const { data: suppression } = await supabaseAdmin
    .from("suppression_list")
    .select("id, reason")
    .eq("phone_number", sanitized)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();

  if (suppression) {
    return {
      allowed: false,
      reason: `Number is on the suppression list (${suppression.reason ?? "opt-out"}).`,
      statusCode: 400,
    };
  }

  // If in test mode, skip paid balance / daily spend cap checks
  if (isTest) {
    return { allowed: true };
  }

  // 3. Check Account Limits (Daily Caps)
  const { data: limits } = await supabaseAdmin
    .from("account_limits")
    .select("daily_spend_cap, daily_call_cap, allowed_countries, is_killed")
    .eq("user_id", userId)
    .maybeSingle();

  if (limits?.is_killed) {
    return {
      allowed: false,
      reason: "Account is suspended.",
      statusCode: 403,
    };
  }

  // Check today's calls count
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count: callsToday } = await supabaseAdmin
    .from("call_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  const dailyCallCap = limits?.daily_call_cap ?? 100;
  if ((callsToday ?? 0) >= dailyCallCap) {
    return {
      allowed: false,
      reason: `Daily call limit reached (${dailyCallCap} calls/day). Contact support to raise this limit.`,
      statusCode: 429,
    };
  }

  return { allowed: true };
}
