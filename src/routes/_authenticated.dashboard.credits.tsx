import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Shield, ShieldCheck, Sparkles, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/credits")({
  head: () => ({ meta: [{ title: "Buy credits — Eginta" }] }),
  component: CreditsPage,
});

type Pkg = {
  id: string;
  price: number;
  badge?: string;
  bonusLabel?: string;
};

const PACKAGES: Pkg[] = [
  { id: "p5", price: 5 },
  { id: "p10", price: 10 },
  { id: "p20", price: 20, badge: "Most Popular" },
  { id: "p50", price: 50, bonusLabel: "5% free" },
  { id: "p100", price: 100, bonusLabel: "10% free" },
];

function bonusPct(price: number) {
  if (price >= 100) return 0.10;
  if (price >= 50) return 0.05;
  return 0;
}

function CreditsPage() {
  const [selectedId, setSelectedId] = useState<string>("p20");
  const [custom, setCustom] = useState<string>("");
  const [autoTopUp, setAutoTopUp] = useState(false);
  const [taxInvoice, setTaxInvoice] = useState(false);
  const [promo, setPromo] = useState("");

  const customAmount = Number(custom);
  const isCustomValid = custom !== "" && !Number.isNaN(customAmount) && customAmount >= 5;
  const selectedPkg = PACKAGES.find((p) => p.id === selectedId);
  const amount = isCustomValid ? customAmount : selectedPkg?.price ?? 0;
  const bonus = Math.round(amount * bonusPct(amount) * 100) / 100;
  const total = Math.round((amount + bonus) * 100) / 100;
  const minutesEstimate = Math.round(amount / 0.015); // ~ india rate as a friendly cap

  function checkout() {
    if (amount < 5) {
      toast.error("Minimum top-up is $5");
      return;
    }
    toast.info("Checkout not yet activated", {
      description: `Eginta will charge $${amount.toFixed(2)} once payments are enabled.`,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Select Your Credit Amount
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your credits are used to make international calls at competitive rates.{" "}
            <a href="/rates" className="text-primary underline-offset-4 hover:underline">
              View our detailed rate calculator →
            </a>
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-sm">
          <div className="font-medium">Need Eginta for the team?</div>
          <a href="/contact" className="text-primary text-xs hover:underline">
            See enterprise plans →
          </a>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: selection */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="text-sm font-medium">
            Choose Amount (USD) <span className="text-destructive">*</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PACKAGES.map((p) => {
              const active = !isCustomValid && selectedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    setCustom("");
                  }}
                  className={cn(
                    "relative rounded-xl border bg-background px-3 py-4 text-center transition-all",
                    active
                      ? "border-primary ring-2 ring-primary/30 shadow-sm"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {p.badge && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                      {p.badge}
                    </span>
                  )}
                  <div className="text-xl font-bold">${p.price}</div>
                  {p.bonusLabel && (
                    <div className="mt-1 text-[11px] font-medium text-primary">
                      {p.bonusLabel}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <Label htmlFor="custom" className="text-sm">
              Or enter custom amount (minimum $5)
            </Label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted-foreground">
                $
              </span>
              <Input
                id="custom"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
            {custom !== "" && !isCustomValid && (
              <p className="mt-1 text-xs text-destructive">Minimum is $5</p>
            )}
          </div>

          <div className="mt-6 space-y-4 border-t border-border/60 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="auto" className="text-sm font-medium">
                  Enable Auto Top-up
                </Label>
                <p className="text-xs text-muted-foreground">
                  Avoid interrupting an important call
                </p>
              </div>
              <Switch id="auto" checked={autoTopUp} onCheckedChange={setAutoTopUp} />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="tax"
                checked={taxInvoice}
                onCheckedChange={(v) => setTaxInvoice(Boolean(v))}
                className="mt-0.5"
              />
              <Label htmlFor="tax" className="text-sm font-normal leading-snug">
                Issue tax-deductible invoice{" "}
                <span className="text-muted-foreground">(address required)</span>
              </Label>
            </div>

            <div>
              <Label htmlFor="promo" className="text-sm">
                Promo Code <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="promo"
                className="mt-2"
                placeholder="Enter promo code"
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        {/* Right: summary */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Order summary
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Credit amount</span>
              <span className="font-medium">${amount.toFixed(2)}</span>
            </div>
            {bonus > 0 && (
              <div className="flex items-center justify-between text-primary">
                <span>Bonus credits</span>
                <span className="font-medium">+ ${bonus.toFixed(2)}</span>
              </div>
            )}
            <div className="my-2 border-t border-border/60" />
            <div className="flex items-center justify-between text-base">
              <span className="font-semibold">Total credits</span>
              <span className="font-bold">${total.toFixed(2)}</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Up to ~{minutesEstimate.toLocaleString()} minutes of international calling time.
          </p>

          <Button className="mt-5 w-full" size="lg" onClick={checkout}>
            <Lock className="h-4 w-4" />
            Secure Checkout
          </Button>

          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              100% Money Back Guarantee. No questions asked.
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" />
              Credits never expire
            </li>
            <li className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Encrypted, PCI-compliant payment
            </li>
            <li className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              <span>*VAT may be added depending on your country and payment method.</span>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}