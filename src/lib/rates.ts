import { parsePhoneNumberFromString } from "libphonenumber-js";

// Per-minute rates in USD. Conservative wholesale-ish numbers — adjust later.
export const RATES: Record<string, number> = {
  US: 0.01, CA: 0.01, GB: 0.015, IE: 0.02, FR: 0.02, DE: 0.02, ES: 0.02, IT: 0.02,
  NL: 0.02, BE: 0.02, PT: 0.025, SE: 0.025, NO: 0.025, DK: 0.025, FI: 0.025,
  PL: 0.03, CH: 0.03, AT: 0.03, CZ: 0.04, GR: 0.04,
  IN: 0.015, CN: 0.02, JP: 0.04, KR: 0.04, SG: 0.03, HK: 0.03, TW: 0.04,
  AU: 0.03, NZ: 0.04, ID: 0.05, MY: 0.04, TH: 0.04, VN: 0.05, PH: 0.18,
  MX: 0.02, BR: 0.04, AR: 0.05, CL: 0.04, CO: 0.05, PE: 0.06,
  AE: 0.18, SA: 0.15, IL: 0.04, TR: 0.06, EG: 0.12,
  ZA: 0.06, NG: 0.08, KE: 0.10, MA: 0.10,
  RU: 0.06, UA: 0.10,
};

export const DEFAULT_RATE = 0.25;

export function getRateForNumber(e164: string): {
  rate: number;
  country: string | null;
} {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed || !parsed.country) return { rate: DEFAULT_RATE, country: null };
  const rate = RATES[parsed.country] ?? DEFAULT_RATE;
  return { rate, country: parsed.country };
}

export function estimatedCostForDuration(seconds: number, ratePerMinute: number) {
  return Math.round((seconds / 60) * ratePerMinute * 10000) / 10000;
}

export function formatCurrency(usd: number) {
  return `$${usd.toFixed(usd < 0.1 ? 4 : 2)}`;
}