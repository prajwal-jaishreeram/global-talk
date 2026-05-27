// Replace each `id` below with the real Polar product UUID from your org.
// Only one-time products are used; auto top-up reuses these via saved-card off-session charges.
export const POLAR_CATALOG = {
  topup: [
    { id: "31fb3479-31eb-49fa-b06a-d213af32298f", price: 5, credits: 5, label: "$5" },
    { id: "32cb7d56-e8bb-4cc9-92a2-a14a20d32073", price: 10, credits: 10, label: "$10" },
    { id: "77a8c431-81d7-411a-967e-a180af574065", price: 25, credits: 27.5, label: "$25", bonusLabel: "+10% bonus" },
    { id: "fa2a348c-4bcf-44c7-8199-55fa78ecac02", price: 50, credits: 60, label: "$50", bonusLabel: "+20% bonus" },
    { id: "91d44eed-386d-4100-99a8-3e8e3139c108", price: 100, credits: 125, label: "$100", bonusLabel: "+25% bonus" },
  ],
  autoTopup: [],
} as const;

// Helper used by auto top-up: pick the smallest top-up package that covers `amount`.
export function pickTopupForAmount(amount: number) {
  const sorted = [...POLAR_CATALOG.topup].sort((a, b) => a.price - b.price);
  return sorted.find((p) => p.price >= amount) ?? sorted[sorted.length - 1];
}