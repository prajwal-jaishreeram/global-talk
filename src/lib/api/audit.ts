import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function recordApiAuditLog(input: {
  userId?: string | null;
  apiKeyId?: string | null;
  request: Request;
  statusCode: number;
}): Promise<void> {
  const { userId, apiKeyId, request, statusCode } = input;
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const url = new URL(request.url);

  try {
    await supabaseAdmin.from("api_audit_logs").insert({
      user_id: userId ?? null,
      api_key_id: apiKeyId ?? null,
      ip_address: ip,
      user_agent: userAgent,
      endpoint: url.pathname,
      http_method: request.method,
      status_code: statusCode,
      request_id: request.headers.get("x-request-id") || null,
    });
  } catch (err) {
    console.warn("Failed to write audit log:", err);
  }
}
