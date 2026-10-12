import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateApiKey, hashApiKey } from "@/lib/api/auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listMyApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, mode, scopes, last_used_at, expires_at, revoked_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { keys: data ?? [] };
  });

export const createNewApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; mode?: "live" | "test" }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const mode = data.mode === "test" ? "test" : "live";
    const name = data.name.trim() || `My ${mode} key`;

    const { fullKey, prefix, hash } = generateApiKey(mode);

    const { data: record, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: userId,
        name,
        key_prefix: prefix,
        key_hash: hash,
        mode,
        scopes: ["calls:read", "calls:write", "billing:read", "webhooks:manage"],
      })
      .select("id, name, key_prefix, mode, created_at")
      .single();

    if (error || !record) throw new Error(error?.message || "Failed to create API key");

    // Also ensure account_limits row exists
    await supabaseAdmin
      .from("account_limits")
      .upsert({ user_id: userId }, { onConflict: "user_id" });

    return {
      key: record,
      fullKey, // Returned once so the user can copy it!
    };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, url, secret, events, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { endpoints: data ?? [] };
  });

export const createNewWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const url = data.url.trim();

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Enter a valid http/https URL.");
    }

    const { randomBytes } = await import("node:crypto");
    const secret = `whsec_${randomBytes(24).toString("hex")}`;

    const { data: endpoint, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .insert({
        user_id: userId,
        url,
        secret,
        events: ["call.queued", "call.awaiting_human", "call.started", "call.completed", "call.failed", "call.canceled"],
        is_active: true,
      })
      .select("id, url, secret, events, is_active, created_at")
      .single();

    if (error || !endpoint) throw new Error(error?.message || "Failed to create webhook endpoint");
    return { endpoint };
  });

export const deleteWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { error } = await supabaseAdmin
      .from("webhook_endpoints")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPendingAgentCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data, error } = await supabaseAdmin
      .from("call_tasks")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["awaiting_human", "queued"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return { tasks: data ?? [] };
  });
