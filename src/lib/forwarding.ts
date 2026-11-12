export type RecipientMessageType = "all" | "inbound" | "outbound" | "otp_only";

export type ForwardRecipient = {
  number: string;
  name?: string;
  group?: string; // e.g. "Personal", "Core Team", "OTP Alerts"
  messageType?: RecipientMessageType; // "all" (default) | "inbound" | "outbound" | "otp_only"
  enabled?: boolean; // true by default
};

export type ForwardMode = "both" | "receive";

export type ForwardConfig = {
  recipients: ForwardRecipient[];
  groups: string[];
  mode: ForwardMode;
};

export const DEFAULT_GROUPS = ["Personal", "Team", "Alerts"];

/**
 * Normalizes phone numbers to standard E.164 (+1234567890).
 * Handles Indian numbers (10 digits starting with 6-9) and US/Canada numbers automatically.
 */
export function normalizeE164(input: string): string {
  if (!input) return "";
  const trimmed = String(input).trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  // 10 digits starting with 6,7,8,9 (India) without +
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  // 10 digits US/Canada
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Parses a forward_to_number database field into a structured list of ForwardRecipient.
 */
export function parseForwardRecipients(raw: string | null | undefined): ForwardRecipient[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();

  // Try JSON object format { recipients: [...], groups: [...], mode: "both" }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      if (Array.isArray(obj.recipients)) {
        return obj.recipients
          .map(normalizeRawRecipient)
          .filter((item: ForwardRecipient | null): item is ForwardRecipient => Boolean(item && /^\+\d{7,16}$/.test(item.number)));
      }
    } catch {}
  }

  // Try JSON array format
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeRawRecipient)
          .filter((item: ForwardRecipient | null): item is ForwardRecipient => Boolean(item && /^\+\d{7,16}$/.test(item.number)));
      }
    } catch {}
  }

  // Fallback to comma/semicolon/newline-separated strings
  return trimmed
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((num) => ({
      number: normalizeE164(num),
      name: "",
      group: "Personal",
      messageType: "all" as RecipientMessageType,
      enabled: true,
    }))
    .filter((item) => /^\+\d{7,16}$/.test(item.number));
}

function normalizeRawRecipient(item: any): ForwardRecipient | null {
  if (!item) return null;
  if (typeof item === "string") {
    const num = normalizeE164(item);
    return num ? { number: num, name: "", group: "Personal", messageType: "all", enabled: true } : null;
  }
  const num = normalizeE164(String(item.number || ""));
  if (!num) return null;
  return {
    number: num,
    name: String(item.name || "").trim(),
    group: String(item.group || "Personal").trim(),
    messageType: (["all", "inbound", "outbound", "otp_only"].includes(item.messageType)
      ? item.messageType
      : "all") as RecipientMessageType,
    enabled: item.enabled !== false,
  };
}

/**
 * Parses full forwarding config including forward mode and custom groups.
 */
export function parseForwardConfig(raw: string | null | undefined): ForwardConfig {
  if (!raw || !raw.trim()) {
    return { recipients: [], groups: [...DEFAULT_GROUPS], mode: "both" };
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const parsedRecipients = parseForwardRecipients(JSON.stringify(obj.recipients || []));
      const extractedGroups = Array.isArray(obj.groups) ? obj.groups.filter(Boolean) : [];
      // Combine with groups found on recipients
      const allGroups = Array.from(
        new Set([...DEFAULT_GROUPS, ...extractedGroups, ...parsedRecipients.map((r) => r.group).filter(Boolean)]),
      );
      return {
        recipients: parsedRecipients,
        groups: allGroups as string[],
        mode: obj.mode === "receive" ? "receive" : "both",
      };
    } catch {}
  }

  const recs = parseForwardRecipients(raw);
  return {
    recipients: recs,
    groups: [...DEFAULT_GROUPS],
    mode: "both",
  };
}

/**
 * Serializes ForwardRecipient array and groups into a JSON string for storage in phone_numbers.forward_to_number.
 */
export function serializeForwardRecipients(
  recipients: ForwardRecipient[],
  mode: ForwardMode = "both",
  groups?: string[],
): string | null {
  if (!recipients || recipients.length === 0) return null;
  const groupsList = groups && groups.length > 0 ? groups : Array.from(new Set(recipients.map((r) => r.group || "Personal")));
  return JSON.stringify({
    recipients: recipients.map((r) => ({
      number: normalizeE164(r.number),
      name: (r.name || "").trim(),
      group: (r.group || "Personal").trim(),
      messageType: r.messageType ?? "all",
      enabled: r.enabled !== false,
    })),
    groups: groupsList,
    mode,
  });
}

/**
 * Determines whether a specific recipient should receive a message based on their granular rule.
 */
export function shouldRecipientReceive(
  recipient: ForwardRecipient,
  direction: "inbound" | "outbound",
  isOtp: boolean,
): boolean {
  if (recipient.enabled === false) return false;
  const type = recipient.messageType ?? "all";
  if (type === "all") return true;
  if (type === "otp_only") return direction === "inbound" && isOtp;
  if (type === "inbound") return direction === "inbound";
  if (type === "outbound") return direction === "outbound";
  return true;
}

/**
 * Extracts phone numbers of active recipients that match the event (inbound/outbound/otp).
 */
export function getRecipientsForEvent(
  raw: string | null | undefined,
  direction: "inbound" | "outbound",
  isOtp: boolean,
): string[] {
  const config = parseForwardConfig(raw);
  return config.recipients
    .filter((r) => shouldRecipientReceive(r, direction, isOtp))
    .map((r) => r.number);
}

/**
 * Extracts pure phone number array for Telnyx SMS dispatching (all enabled recipients).
 */
export function extractForwardPhoneNumbers(raw: string | null | undefined): string[] {
  return parseForwardRecipients(raw)
    .filter((r) => r.enabled !== false)
    .map((r) => r.number);
}

/**
 * Smart OTP / Verification code detector.
 * Scans SMS content for 4-8 digit codes, Google-style 'G-123456', or labeled verification codes.
 */
export function extractOtpCode(body: string | null | undefined): string | null {
  if (!body) return null;

  // 1. Google style G-123456 or similar
  const gMatch = body.match(/\b([A-Z]-\d{4,8})\b/i);
  if (gMatch && gMatch[1]) return gMatch[1];

  // 2. Labeled patterns like "code is 123456", "otp: 492019", "code: 123-456", "pin: 4829"
  const labeledRegex =
    /(?:code|otp|pin|token|verification code|one-time password|is)[:\s-]+([A-Z0-9]{4,8}|\d{3}[-\s]\d{3})/i;
  const labeledMatch = body.match(labeledRegex);
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1].replace(/[-\s]/g, "");
    if (/^\d{4,8}$/.test(candidate) || /^[A-Z0-9]{4,8}$/i.test(candidate)) {
      return candidate;
    }
  }

  // 3. Standalone 4-8 digit numbers if context is OTP / verification related
  const isOtpLike =
    /(?:otp|code|verification|verify|password|pin|token|secret|login|confirm|auth|security|expires|valid)/i.test(
      body,
    );

  if (isOtpLike) {
    // Check 123-456 pattern
    const hyphenMatch = body.match(/\b(\d{3})[- ](\d{3})\b/);
    if (hyphenMatch) {
      return `${hyphenMatch[1]}${hyphenMatch[2]}`;
    }

    // 4 to 8 digits
    const digitMatch = body.match(/\b(\d{4,8})\b/);
    if (digitMatch && digitMatch[1]) {
      return digitMatch[1];
    }
  }

  return null;
}
