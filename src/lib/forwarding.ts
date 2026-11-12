export type ForwardRecipient = {
  number: string;
  name?: string;
};

/**
 * Normalizes phone numbers to standard E.164 (+1234567890).
 * Handles Indian numbers (10 digits starting with 6-9) and US/Canada numbers automatically.
 */
export function normalizeE164(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
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
 * Supports both JSON array strings `[{"number":"+91...","name":"Personal"}]` and legacy
 * comma-separated strings `+918605222604, +918905020697`.
 */
export function parseForwardRecipients(raw: string | null | undefined): ForwardRecipient[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();

  // Try JSON format
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && (typeof item === "string" || typeof item.number === "string"))
          .map((item) => {
            if (typeof item === "string") {
              return { number: normalizeE164(item), name: "" };
            }
            return {
              number: normalizeE164(String(item.number || "")),
              name: String(item.name || "").trim(),
            };
          })
          .filter((item) => /^\+\d{7,16}$/.test(item.number));
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback to comma/semicolon/newline-separated strings
  return trimmed
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((num) => ({
      number: normalizeE164(num),
      name: "",
    }))
    .filter((item) => /^\+\d{7,16}$/.test(item.number));
}

/**
 * Serializes ForwardRecipient array into a JSON string for storage in phone_numbers.forward_to_number.
 */
export function serializeForwardRecipients(recipients: ForwardRecipient[]): string | null {
  if (!recipients || recipients.length === 0) return null;
  return JSON.stringify(
    recipients.map((r) => ({
      number: normalizeE164(r.number),
      name: (r.name || "").trim(),
    })),
  );
}

/**
 * Extracts pure phone number array for Telnyx SMS dispatching.
 */
export function extractForwardPhoneNumbers(raw: string | null | undefined): string[] {
  return parseForwardRecipients(raw).map((r) => r.number);
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
