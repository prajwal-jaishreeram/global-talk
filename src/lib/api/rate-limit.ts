const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(keyId: string, limit = 60, windowMs = 60_000): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true };
}
