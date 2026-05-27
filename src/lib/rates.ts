import { parsePhoneNumberFromString } from "libphonenumber-js";

// ─────────────────────────────────────────────────────────────────────────────
// Pricing model
// ─────────────────────────────────────────────────────────────────────────────
// CALL_PRICE_MARKUP is the multiplier applied to Telnyx wholesale to get the
// retail (user-facing) per-minute rate. retail = wholesale × CALL_PRICE_MARKUP.
// Centralized so future tweaks are a single-line change.
export const CALL_PRICE_MARKUP = 2;

// Minimum per-minute retail floor. Cheap destinations like US/CA/IN have
// wholesale costs of ~$0.003-0.012, so 2× still leaves us with ~$0.007-0.024.
// We charge at least MIN_RETAIL_PER_MINUTE so very-cheap routes still produce
// meaningful margin. Expensive destinations (e.g. mobile in EU/MEA) sit far
// above this floor and use the pure 2× markup.
export const MIN_RETAIL_PER_MINUTE = 0.02;

function applyRetailMarkup(wholesale: number) {
  return round4(Math.max(wholesale * CALL_PRICE_MARKUP, MIN_RETAIL_PER_MINUTE));
}

// Per-destination wholesale (Telnyx PAYG, USD/min) for landline + mobile.
// Sourced from Telnyx's public pay-as-you-go rate sheet — verify against your
// own Mission Control "Rate Insights" CSV before going live with paying users.
//
// Countries not listed here fall back to FALLBACK_WHOLESALE.
type DestType = "landline" | "mobile";
type CountryRates = Record<DestType, number>;

const FALLBACK_WHOLESALE = 0.15; // applied to both landline + mobile when unknown

const WHOLESALE: Record<string, CountryRates> = {
  // North America
  US: { landline: 0.0035, mobile: 0.0035 },
  CA: { landline: 0.0040, mobile: 0.0050 },
  MX: { landline: 0.020,  mobile: 0.040  },
  // Western Europe
  GB: { landline: 0.0090, mobile: 0.025  },
  IE: { landline: 0.013,  mobile: 0.040  },
  FR: { landline: 0.013,  mobile: 0.050  },
  DE: { landline: 0.011,  mobile: 0.080  },
  ES: { landline: 0.012,  mobile: 0.040  },
  IT: { landline: 0.014,  mobile: 0.080  },
  NL: { landline: 0.012,  mobile: 0.060  },
  BE: { landline: 0.020,  mobile: 0.070  },
  PT: { landline: 0.022,  mobile: 0.060  },
  CH: { landline: 0.020,  mobile: 0.080  },
  AT: { landline: 0.022,  mobile: 0.080  },
  // Nordics
  SE: { landline: 0.020,  mobile: 0.090  },
  NO: { landline: 0.025,  mobile: 0.110  },
  DK: { landline: 0.025,  mobile: 0.110  },
  FI: { landline: 0.025,  mobile: 0.090  },
  // Eastern Europe & CIS
  PL: { landline: 0.022,  mobile: 0.060  },
  CZ: { landline: 0.040,  mobile: 0.090  },
  GR: { landline: 0.030,  mobile: 0.080  },
  RU: { landline: 0.030,  mobile: 0.040  },
  UA: { landline: 0.080,  mobile: 0.140  },
  TR: { landline: 0.040,  mobile: 0.060  },
  // Asia-Pacific
  IN: { landline: 0.012,  mobile: 0.012  },
  CN: { landline: 0.012,  mobile: 0.012  },
  JP: { landline: 0.025,  mobile: 0.110  },
  KR: { landline: 0.040,  mobile: 0.040  },
  SG: { landline: 0.030,  mobile: 0.030  },
  HK: { landline: 0.025,  mobile: 0.025  },
  TW: { landline: 0.040,  mobile: 0.080  },
  AU: { landline: 0.020,  mobile: 0.070  },
  NZ: { landline: 0.030,  mobile: 0.080  },
  ID: { landline: 0.040,  mobile: 0.060  },
  MY: { landline: 0.040,  mobile: 0.040  },
  TH: { landline: 0.040,  mobile: 0.060  },
  VN: { landline: 0.040,  mobile: 0.060  },
  PH: { landline: 0.180,  mobile: 0.220  },
  // South America
  BR: { landline: 0.040,  mobile: 0.180  },
  AR: { landline: 0.060,  mobile: 0.110  },
  CL: { landline: 0.030,  mobile: 0.060  },
  CO: { landline: 0.040,  mobile: 0.180  },
  PE: { landline: 0.060,  mobile: 0.140  },
  // Middle East & Africa
  AE: { landline: 0.180,  mobile: 0.220  },
  SA: { landline: 0.150,  mobile: 0.180  },
  IL: { landline: 0.030,  mobile: 0.080  },
  EG: { landline: 0.120,  mobile: 0.180  },
  ZA: { landline: 0.060,  mobile: 0.150  },
  NG: { landline: 0.080,  mobile: 0.110  },
  KE: { landline: 0.100,  mobile: 0.140  },
  MA: { landline: 0.110,  mobile: 0.220  },
};

// Public, per-country, per-destination rates. Both wholesale (what Telnyx
// charges us) and retail (what we charge users, after CALL_PRICE_MARKUP).
// The rate calculator surfaces both so you can audit margin at a glance.
export const VOICE_RATES: Record<
  string,
  { landline: { wholesale: number; retail: number }; mobile: { wholesale: number; retail: number } }
> = Object.fromEntries(
  Object.entries(WHOLESALE).map(([code, rates]) => [
    code,
    {
      landline: {
        wholesale: rates.landline,
        retail: applyRetailMarkup(rates.landline),
      },
      mobile: {
        wholesale: rates.mobile,
        retail: applyRetailMarkup(rates.mobile),
      },
    },
  ]),
);

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

// Legacy compatibility: many UI surfaces still pull a single rate per country.
// We expose the mobile retail rate as the canonical "per-minute" headline,
// since that's the higher / more conservative number for billing and matches
// the worst case when number type can't be determined.
export const RATES: Record<string, number> = Object.fromEntries(
  Object.entries(VOICE_RATES).map(([code, r]) => [code, r.mobile.retail]),
);

// Default retail rate (USD/min) for any destination we don't have a quote for.
// FALLBACK_WHOLESALE × CALL_PRICE_MARKUP, floored at MIN_RETAIL_PER_MINUTE.
export const DEFAULT_RATE = applyRetailMarkup(FALLBACK_WHOLESALE);

export function getWholesaleRateForNumber(e164: string): {
  rate: number;
  country: string | null;
  destinationType: DestType | "unknown";
} {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed || !parsed.country) {
    return { rate: FALLBACK_WHOLESALE, country: null, destinationType: "unknown" };
  }
  const country = parsed.country;
  const rates = WHOLESALE[country];
  if (!rates) {
    return { rate: FALLBACK_WHOLESALE, country, destinationType: "unknown" };
  }
  // libphonenumber returns "MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE", etc.
  // We bias toward mobile (higher rate) when ambiguous so we never undercharge.
  const t = parsed.getType();
  const isLandline = t === "FIXED_LINE";
  const destinationType: DestType = isLandline ? "landline" : "mobile";
  return { rate: rates[destinationType], country, destinationType };
}

// Retail rate (what we charge the user). This is what the dialer + billing
// pipeline must use. Mobile vs landline detection happens here so the user
// sees the correct price the moment they finish typing the number.
export function getRateForNumber(e164: string): {
  rate: number;
  country: string | null;
  destinationType?: DestType | "unknown";
} {
  const w = getWholesaleRateForNumber(e164);
  return {
    rate: applyRetailMarkup(w.rate),
    country: w.country,
    destinationType: w.destinationType,
  };
}

export function estimatedCostForDuration(seconds: number, ratePerMinute: number) {
  return Math.round((seconds / 60) * ratePerMinute * 10000) / 10000;
}

export function formatCurrency(usd: number) {
  return `$${usd.toFixed(usd < 0.1 ? 4 : 2)}`;
}

/**
 * Show currency with full precision so micro-deductions like $0.005 don't get
 * rounded to $0.00. Always at least 2 decimals, up to 4. Trailing zeros past
 * the first 2 decimals are trimmed for readability.
 *
 *   10        -> "$10.00"
 *   9.9985    -> "$9.9985"
 *   9.995     -> "$9.995"
 *   0.005     -> "$0.005"
 *   0         -> "$0.00"
 */
export function formatMoneyExact(usd: number): string {
  if (!Number.isFinite(usd)) return "$0.00";
  let s = usd.toFixed(4);
  s = s.replace(/0+$/, "");
  const dot = s.indexOf(".");
  if (dot >= 0) {
    const decimals = s.length - dot - 1;
    if (decimals < 2) s = s + "0".repeat(2 - decimals);
    if (s.endsWith(".")) s = s + "00";
  } else {
    s = s + ".00";
  }
  return `$${s}`;
}