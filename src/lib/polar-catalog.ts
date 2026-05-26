export const POLAR_CATALOG = {
  topup: [
    { id: "7b998b07-0020-483d-899e-f322454bbc6e", price: 5, credits: 5, label: "$5" },
    { id: "6d2f43bc-ab1e-4016-be04-d43b2731b023", price: 10, credits: 10, label: "$10" },
    { id: "49b4d84d-f656-441b-9402-553173f1d1a5", price: 25, credits: 27.5, label: "$25", bonusLabel: "+10% bonus" },
    { id: "03b322b2-1d11-42ab-83f4-e64df7460afd", price: 50, credits: 60, label: "$50", bonusLabel: "+20% bonus" },
  ],
  autoTopup: [
    { id: "67c177b6-7a2a-4a8a-9fcf-412b1f69655c", price: 10, credits: 10, label: "$10/mo" },
    { id: "1dfc7636-8c38-4caf-8d15-63a595c78e13", price: 25, credits: 27.5, label: "$25/mo", bonusLabel: "+10%" },
    { id: "3a5d33d3-9e3d-4bef-bc98-2207b2285eae", price: 50, credits: 60, label: "$50/mo", bonusLabel: "+20%" },
  ],
} as const;