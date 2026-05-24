import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Shield, ShieldCheck, Sparkles, Lock, Info, Repeat, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createPolarCheckout,
  confirmPolarCheckout,
  openPolarCustomerPortal,
  cancelAutoTopup,
  getBillingStatus,
  POLAR_CATALOG,
} from "@/lib/polar.functions";

export const Route = createFileRoute("/_authenticated/dashboard/credits")({
  head: () => ({ meta: [{ title: "Buy credits — Eginta" }] }),
  component: CreditsPage,
});

const TOPUPS = POLAR_CATALOG.topup;
const AUTO = POLAR_CATALOG.autoTopup;

function CreditsPage() {
  const [selectedId, setSelectedId] = useState<string>(TOPUPS[2].id);
  const [autoSelectedId, setAutoSelectedId] = useState<string>(AUTO[1].id);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const startCheckout = useServerFn(createPolarCheckout);
  const confirmSession = useServerFn(confirmPolarCheckout);
  const openPortal = useServerFn(openPolarCustomerPortal);
  const cancelAuto = useServerFn(cancelAutoTopup);
  const fetchStatus = useServerFn(getBillingStatus);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const statusParam = url.searchParams.get("purchase");
    const checkoutId = url.searchParams.get("checkout_id");
    if (statusParam === "cancelled") {
      toast.message("Checkout cancelled");
      url.searchParams.delete("purchase");
      window.history.replaceState({}, "", url.toString());
    } else if (statusParam === "success" && checkoutId) {
      confirmSession({ data: { checkoutId } })
        .then((r) => {
          if (r.credited) toast.success("Credits added to your balance");
          else toast.message("Payment received", { description: "Credits will appear in a few seconds." });
          refetchStatus();
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not confirm payment"))
        .finally(() => {
          url.searchParams.delete("purchase");
          url.searchParams.delete("checkout_id");
          window.history.replaceState({}, "", url.toString());
        });
    }
  }, [confirmSession, refetchStatus]);

  const selectedPkg = TOPUPS.find((p) => p.id === selectedId) ?? TOPUPS[0];
  const amount = selectedPkg.price;
  const total = selectedPkg.credits;
  const bonus = Math.round((total - amount) * 100) / 100;
  const minutesEstimate = Math.round(total / 0.015);

  async function checkout() {
    setLoading(true);
    try {
      const { url } = await startCheckout({ data: { productId: selectedPkg.id } });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setLoading(false);
    }
  }

  async function startAuto() {
    setAutoLoading(true);
    try {
      const { url } = await startCheckout({ data: { productId: autoSelectedId } });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start subscription");
      setAutoLoading(false);
    }
  }

  async function managePortal() {
    try {
      const { url } = await openPortal();
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open portal");
    }
  }

  async function cancel() {
    try {
      const r = await cancelAuto();
      if (r.cancelled) {
        toast.success("Auto top-up will end at period end");
        refetchStatus();
      } else toast.message("No active auto top-up");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Top up your calling credits
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One-time top-up or never run out with monthly auto top-up.{" "}
            <a href="/rates" className="text-primary underline-offset-4 hover:underline">
              View rate calculator →
            </a>
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
          <div className="text-xs text-muted-foreground">Current balance</div>
          <div className="text-xl font-bold">${(status?.creditBalance ?? 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="text-sm font-medium">One-time top-up</div>
            <p className="mt-1 text-xs text-muted-foreground">Pay once, credits never expire.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TOPUPS.map((p) => {
                const active = selectedId === p.id;
                const bonusLabel = "bonusLabel" in p ? p.bonusLabel : undefined;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "relative rounded-xl border bg-background px-3 py-4 text-center transition-all",
                      active ? "border-primary ring-2 ring-primary/30 shadow-sm" : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="text-xl font-bold">{p.label}</div>
                    {bonusLabel && <div className="mt-1 text-[11px] font-medium text-primary">{bonusLabel}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">${p.credits.toFixed(2)} credits</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Repeat className="h-4 w-4 text-primary" /> Auto top-up (monthly)
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Never run out mid-call. Charged monthly — cancel anytime.
            </p>

            {status?.autoTopupActive ? (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Check className="h-4 w-4" /> Auto top-up is active
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Credits are added automatically each billing cycle.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={managePortal}>
                    <ExternalLink className="h-3.5 w-3.5" /> Manage billing
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancel}>
                    Cancel auto top-up
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {AUTO.map((p) => {
                    const active = autoSelectedId === p.id;
                    const bonusLabel = "bonusLabel" in p ? p.bonusLabel : undefined;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAutoSelectedId(p.id)}
                        className={cn(
                          "relative rounded-xl border bg-background px-3 py-4 text-center transition-all",
                          active ? "border-primary ring-2 ring-primary/30 shadow-sm" : "border-border hover:border-primary/40",
                        )}
                      >
                        <div className="text-lg font-bold">{p.label}</div>
                        {bonusLabel && <div className="mt-1 text-[11px] font-medium text-primary">{bonusLabel}</div>}
                        <div className="mt-1 text-[11px] text-muted-foreground">${p.credits.toFixed(2)}/mo</div>
                      </button>
                    );
                  })}
                </div>
                <Button className="mt-4 w-full" variant="secondary" onClick={startAuto} disabled={autoLoading}>
                  <Repeat className="h-4 w-4" />
                  {autoLoading ? "Redirecting…" : "Enable auto top-up"}
                </Button>
              </>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Order summary
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">You pay</span>
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
            Up to ~{minutesEstimate.toLocaleString()} minutes of international calling.
          </p>
          <Button className="mt-5 w-full" size="lg" onClick={checkout} disabled={loading}>
            <Lock className="h-4 w-4" />
            {loading ? "Redirecting…" : `Buy ${selectedPkg.label} credits`}
          </Button>
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Powered by Polar — international cards supported.
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" /> Credits never expire
            </li>
            <li className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-primary" /> Encrypted, PCI-compliant checkout
            </li>
            <li className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              <span>VAT/GST handled by Polar (Merchant of Record).</span>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}