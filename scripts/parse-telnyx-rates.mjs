// One-off CLI: parses the Telnyx Conversational rate deck CSV and emits a
// per-country (ISO) min wholesale rate for landline and mobile, formatted as
// a TypeScript object literal we can paste into src/lib/rates.ts.
//
// Strategy: for every row, classify as mobile (Description contains "Mobile")
// or landline (everything else, but excluding clearly premium routes like
// "Premium", "Special", "Toll Free" so we don't inflate the country rate).
// Per (country, type) we keep the MIN rate — that matches what Telnyx will
// actually charge for the cheapest sub-prefix, which is the conservative
// (highest-margin) value to surface to users.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(__dirname, "../src/assets/global_conver_0159685afa.csv");
const outPath = resolve(__dirname, "telnyx-rates.generated.json");

// Categories we always exclude — these are non-geographic / premium / service
// numbers that don't represent the typical user-dialed cost for the country.
const EXCLUDE_DESC = [
  "Premium",
  "Service",
  "Personal",
  "Toll Free",
  "Tollfree",
  "Audiotex",
  "Audiotext",
  "Special",
  "Nomadic",
  "Satellite",
  "Shared Cost",
];

function parseCsvLine(line) {
  // Telnyx CSV uses double-quoted fields with commas inside. Tiny parser.
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const text = readFileSync(csvPath, "utf8");
const lines = text.split(/\r?\n/);
const header = parseCsvLine(lines[0]);
const idx = (name) => header.indexOf(name);
const ISO = idx("ISO");
const ORIG = idx("Origination Prefixes");
const DESC = idx("Description");
const RATE = idx("Rate");

const perCountry = new Map(); // iso -> { landline:[], mobile:[] }

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const cols = parseCsvLine(line);
  const iso = cols[ISO]?.trim();
  const orig = (cols[ORIG] ?? "").trim();
  const desc = cols[DESC] ?? "";
  const rateRaw = cols[RATE];
  if (!iso || iso.length !== 2) continue;
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate <= 0) continue;
  // Telnyx publishes two rates per destination: the default rate (empty
  // Origination Prefixes) and a "local"-routed rate (orig === "local") that
  // most accounts actually hit. Keep both and let the bulk-rate selector
  // pick the most common value. Skip every other Origination Prefixes value
  // (those are surcharge / per-source-number routes).
  if (orig && orig !== "local") continue;
  // Skip non-geographic / premium / service buckets.
  if (EXCLUDE_DESC.some((k) => desc.includes(k))) continue;

  if (!perCountry.has(iso)) {
    perCountry.set(iso, {
      // [defaultRoute, localRoute] for each line type.
      landline: { default: [], local: [] },
      mobile: { default: [], local: [] },
    });
  }
  const bucket = perCountry.get(iso);
  const isMobile = /Mobile/i.test(desc);
  const lineType = isMobile ? bucket.mobile : bucket.landline;
  if (orig === "local") lineType.local.push(rate);
  else lineType.default.push(rate);
}

const result = {};
function bulkRate(arr) {
  if (!arr.length) return null;
  // Drop sub-cent placeholder/test rows.
  const cleaned = arr.filter((r) => r >= 0.001);
  const pool = cleaned.length ? cleaned : arr;
  // Mode: rate value that appears most often across sub-prefixes. This is the
  // tier-1 / bulk rate Telnyx charges on the overwhelming majority of prefixes.
  // Median is too easily dragged up by a handful of expensive sub-routes;
  // min is too easily dragged down by single-prefix promo rates.
  const counts = new Map();
  for (const r of pool) counts.set(r, (counts.get(r) ?? 0) + 1);
  let bestRate = null;
  let bestCount = -1;
  for (const [rate, count] of counts.entries()) {
    if (count > bestCount || (count === bestCount && rate < bestRate)) {
      bestRate = rate;
      bestCount = count;
    }
  }
  return bestRate;
}

// For each (country, line type) compute mode of default-route and mode of
// local-route, then take the smaller. Telnyx accounts default to local
// routing where available, so this matches what we'll actually be billed.
function pickRate(pool) {
  const d = bulkRate(pool.default);
  const l = bulkRate(pool.local);
  if (d == null) return l;
  if (l == null) return d;
  return Math.min(d, l);
}

for (const [iso, b] of perCountry.entries()) {
  if (iso === "ZZ") continue; // Telnyx "unknown destination" sentinel
  const lRate = pickRate(b.landline);
  const mRate = pickRate(b.mobile);
  result[iso] = {
    // Fall back to the other line type if one is missing (some small
    // territories only publish a single combined rate).
    landline: lRate ?? mRate ?? null,
    mobile: mRate ?? lRate ?? null,
    landlineSamples: b.landline.default.length + b.landline.local.length,
    mobileSamples: b.mobile.default.length + b.mobile.local.length,
  };
}

writeFileSync(outPath, JSON.stringify(result, null, 2));

// Also emit a paste-ready TS literal sorted alphabetically by ISO.
const isos = Object.keys(result).sort();
const lines2 = [];
for (const iso of isos) {
  const r = result[iso];
  if (r.landline == null || r.mobile == null) continue;
  lines2.push(`  ${iso}: { landline: ${r.landline.toFixed(4)}, mobile: ${r.mobile.toFixed(4)} },`);
}
writeFileSync(resolve(__dirname, "telnyx-rates.generated.ts"), lines2.join("\n") + "\n");

console.log(`Parsed ${isos.length} countries -> ${outPath}`);
console.log(`Sample (US/IN/GB/DE/PH/AE):`);
for (const iso of ["US", "IN", "GB", "DE", "PH", "AE", "CA", "FR", "AU"]) {
  const r = result[iso];
  if (r) console.log(`  ${iso}: landline=${r.landline} (n=${r.landlineSamples}), mobile=${r.mobile} (n=${r.mobileSamples})`);
}
