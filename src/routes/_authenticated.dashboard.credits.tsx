import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/credits")({
  head: () => ({ meta: [{ title: "Buy credits — Ringlink" }] }),
  component: CreditsPage,
});

const PACKAGES = [
  { id: "p5", price: 5, credits: 5, bonus: 0, popular: false },
  { id: "p10", price: 10, credits: 11, bonus: 1, popular: true },
  { id: "p25", price: 25, credits: 28, bonus: 3, popular: false },
  { id: "p50", price: 50, credits: 58, bonus: 8, popular: false },
];

function CreditsPage() {
  function buy(id: string) {
    toast.info("Checkout not yet activated", {
      description: `Package ${id}: payments will be wired in once Stripe is enabled.`,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Top up credits</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pay-as-you-go. No subscription. Credits never expire.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PACKAGES.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl border bg-card p-5 ${p.popular ? "border-primary/60" : "border-border"}`}
          >
            {p.popular && (
              <span className="absolute -top-2 right-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                BEST VALUE
              </span>
            )}
            <div className="text-3xl font-bold">${p.price}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              ${p.credits.toFixed(2)} in credits
              {p.bonus > 0 && <span className="ml-1 text-primary">+${p.bonus} bonus</span>}
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Credits never expire</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> All destinations</li>
            </ul>
            <Button className="mt-5 w-full" onClick={() => buy(p.id)} variant={p.popular ? "default" : "outline"}>
              Buy ${p.price}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}