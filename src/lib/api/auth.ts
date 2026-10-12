import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  mode: "live" | "test";
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ApiAccountContext {
  user_id: string;
  key: ApiKeyRecord;
  is_test: boolean;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(mode: "live" | "test" = "live"): {
  fullKey: string;
  prefix: string;
  hash: string;
} {
  const randomPart = randomBytes(24).toString("hex");
  const fullKey = `rg_${mode}_${randomPart}`;
  const prefix = fullKey.slice(0, 15); // e.g. "rg_live_a1b2c3d"
  const hash = hashApiKey(fullKey);
  return { fullKey, prefix, hash };
}

export async function validateApiKeyHeader(authHeader: string | null): Promise<{
  context?: ApiAccountContext;
  error?: string;
  statusCode?: number;
}> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or malformed Authorization header. Expected 'Bearer rg_live_...'", statusCode: 401 };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("rg_live_") && !token.startsWith("rg_test_")) {
    return { error: "Invalid API key format. Must begin with rg_live_ or rg_test_", statusCode: 401 };
  }

  const hash = hashApiKey(token);

  const { data: keyRecord, error: keyErr } = await supabaseAdmin
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash)
    .maybeSingle();

  if (keyErr || !keyRecord) {
    return { error: "Invalid API key.", statusCode: 401 };
  }

  if (keyRecord.revoked_at) {
    return { error: "API key has been revoked.", statusCode: 403 };
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { error: "API key has expired.", statusCode: 403 };
  }

  // Check account killswitch
  const { data: limits } = await supabaseAdmin
    .from("account_limits")
    .select("is_killed")
    .eq("user_id", keyRecord.user_id)
    .maybeSingle();

  if (limits?.is_killed) {
    return { error: "Account API access is suspended.", statusCode: 403 };
  }

  // Update last_used_at asynchronously
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then();

  return {
    context: {
      user_id: keyRecord.user_id,
      key: keyRecord as ApiKeyRecord,
      is_test: keyRecord.mode === "test",
    },
  };
}
