import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Shield,
  ShieldCheck,
  Sparkles,
  Lock,
  Info,
  Repeat,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createPolarCheckout,
  confirmPolarCheckout,
  openPolarCustomerPortal,
  cancelAutoTopup,
  saveAutoTopupSettings,
  getBillingStatus,
} from "@/lib/polar.functions";
import { POLAR_CATALOG } from "@/lib/polar-catalog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatMoneyExact } from "@/lib/rates";
import { useCreditBalance } from "@/hooks/use-credit-balance";
import { grantTestCredits } from "@/lib/credits.functions";
import { useAuthState } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/dashboard/credits")({
  head: () => ({ meta: [{ title: "Buy credits — Ringringa" }] }),
  component: CreditsPage,
});

const TOPUPS = POLAR_CATALOG.topup;
const TEST_CREDIT_EMAIL = "prajwalshindeee@gmail.com";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) return message;
  }
  return fallback;
}

function CreditsPage() {
  const [selectedId, setSelectedId] = useState<string>(TOPUPS[2].id);
  const [loading, setLoading] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [threshold, setThreshold] = useState<string>("2");
  const [autoAmount, setAutoAmount] = useState<string>("20");
  const [savingAuto, setSavingAuto] = useState(false);
  const { balance, refresh: refreshBalance } = useCreditBalance();
  const { user } = useAuthState();
  const [grantingTestCredits, setGrantingTestCredits] = useState(false);

  const startCheckout = useServerFn(createPolarCheckout);
  const confirmSession = useServerFn(confirmPolarCheckout);
  const openPortal = useServerFn(openPolarCustomerPortal);
  const cancelAuto = useServerFn(cancelAutoTopup);
  const saveAuto = useServerFn(saveAutoTopupSettings);
  const fetchStatus = useServerFn(getBillingStatus);
  const grantTest = useServerFn(grantTestCredits);
  const canGrantTestCredits = user?.email?.toLowerCase() === TEST_CREDIT_EMAIL;

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (!status) return;
    setAutoEnabled(status.autoTopupActive);
    setThreshold(String(status.autoTopupThreshold ?? 2));
    setAutoAmount(String(status.autoTopupAmount ?? 20));
  }, [status]);

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
          else
            toast.message("Payment received", {
              description: "Credits will appear in a few seconds.",
            });
          refetchStatus();
          refreshBalance();
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not confirm payment"))
        .finally(() => {
          url.searchParams.delete("purchase");
          url.searchParams.delete("checkout_id");
          window.history.replaceState({}, "", url.toString());
        });
    }
  }, [confirmSession, refetchStatus, refreshBalance]);

  const selectedPkg = TOPUPS.find((p) => p.id === selectedId) ?? TOPUPS[0];
  const amount = selectedPkg.price;
  const total = selectedPkg.credits;
  const bonus = Math.round((total - amount) * 100) / 100;
  const minutesEstimate = Math.round(total / 0.015);

  async function checkout() {
    setLoading(true);
    try {
      const { url } = await startCheckout({
        data: { productId: selectedPkg.id, origin: window.location.origin },
      });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setLoading(false);
    }
  }

  async function saveAutoSettings(nextEnabled: boolean) {
    setSavingAuto(true);
    try {
      const t = Number(threshold);
      const a = Number(autoAmount);
      if (Number.isNaN(t) || Number.isNaN(a)) throw new Error("Enter valid numbers");
      await saveAuto({ data: { enabled: nextEnabled, threshold: t, amount: a } });
      setAutoEnabled(nextEnabled);
      toast.success(nextEnabled ? "Auto top-up enabled" : "Auto top-up disabled");
      refetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSavingAuto(false);
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

  async function addTestCredits() {
    setGrantingTestCredits(true);
    try {
      const result = await grantTest();
      await refreshBalance();
      toast.success(`Added $${result.amount.toFixed(2)} test credits`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not add test credits"));
    } finally {
      setGrantingTestCredits(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 text-[#1C1C1B]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-black/10 pb-6">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-[#8B6B55] font-semibold mb-2">
            ◆ SETTLEMENT LEDGER & LIQUIDITY
          </div>
          <h1 className="serif text-3xl sm:text-4xl font-light tracking-tight text-[#1C1C1B]">
            Deposit Calling Credits
          </h1>
          <p className="mt-1 text-xs text-black/60 font-light">
            Instant micro-settlement for agent-initiated PSTN calls.{" "}
            <a href="/rates" className="mono text-black underline underline-offset-4 hover:opacity-80">
              View live rate table →
            </a>
          </p>
        </div>
        <div className="border border-black/10 bg-[#FAF8F5] p-4 text-sm shadow-sm min-w-[200px]">
          <div className="mono text-[10px] uppercase tracking-wider text-black/50">AVAILABLE BALANCE</div>
          <div className="text-2xl serif font-light text-[#1C1C1B] mt-0.5">
            {balance === null ? "-" : formatMoneyExact(balance)}
          </div>
          {canGrantTestCredits && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 w-full border-black/20 mono text-[10px] uppercase tracking-wider"
              onClick={addTestCredits}
              disabled={grantingTestCredits}
            >
              <Plus className="h-3 w-3 mr-1" />
              {grantingTestCredits ? "Adding..." : "+$20 Test Liquidity"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="border border-black/10 bg-[#FAF8F5] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-dashed border-black/10 pb-3 mb-4">
              <span className="mono text-xs font-semibold uppercase tracking-wider text-black">Prepaid Liquidity Tiers</span>
              <span className="mono text-[10px] text-black/40">NO_EXPIRATION</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {TOPUPS.map((p, index) => {
                const active = selectedId === p.id;
                const bonusLabel = "bonusLabel" in p ? p.bonusLabel : undefined;
                const centerLastMobile = TOPUPS.length % 2 === 1 && index === TOPUPS.length - 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "relative border px-3 py-4 text-center transition-all",
                      active
                        ? "border-black bg-[#1C1C1B] text-[#F2F0EB] shadow-md"
                        : "border-black/15 bg-[#F2F0EB] text-[#1C1C1B] hover:border-black/40",
                      centerLastMobile &&
                        "col-span-2 mx-auto w-full max-w-[11rem] sm:col-span-1 sm:mx-0 sm:w-auto sm:max-w-none",
                    )}
                  >
                    <div className="serif text-xl font-medium">{p.label}</div>
                    {bonusLabel && (
                      <div className={cn("mt-1 mono text-[10px] font-bold uppercase", active ? "text-[#D4E157]" : "text-[#8B6B55]")}>
                        {bonusLabel}
                      </div>
                    )}
                    <div className={cn("mt-1 mono text-[11px]", active ? "text-white/70" : "text-black/50")}>
                      ${p.credits.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-black/10 bg-[#FAF8F5] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-black/10 pb-3">
              <label
                htmlFor="auto-topup-toggle"
                className="flex cursor-pointer items-center gap-2 mono text-xs uppercase tracking-wider text-black font-semibold"
              >
                <Repeat className="h-3.5 w-3.5 text-black/70" /> Auto-Replenish Buffer
                {autoEnabled && (
                  <span className="bg-[#2A382E]/10 text-[#2A382E] px-2 py-0.5 text-[9px] mono uppercase">
                    ACTIVE
                  </span>
                )}
              </label>
              <Switch
                id="auto-topup-toggle"
                checked={autoEnabled}
                disabled={savingAuto}
                onCheckedChange={(v) => saveAutoSettings(v)}
              />
            </div>
            <p className="mt-3 text-xs text-black/60 font-light leading-relaxed">
              When account balance drops below the threshold, auto-charge your saved card to prevent agent calls from failing mid-sequence. No recurring retainer or monthly fees.
            </p>

            {!status?.hasSavedCard && (
              <p className="mt-3 border border-amber-600/20 bg-amber-500/10 p-3 mono text-[11px] text-amber-900">
                Note: Complete a single one-time deposit first to securely tokenize your card with Polar.
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="auto-threshold" className="mono text-[10px] uppercase tracking-wider text-black/60">
                  Trigger Floor Threshold ($)
                </Label>
                <div className="relative">
                  <Input
                    id="auto-threshold"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={100}
                    step={"0.5"}
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    onBlur={() => autoEnabled && saveAutoSettings(true)}
                    className="bg-[#F2F0EB] border-black/20 mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auto-amount" className="mono text-[10px] uppercase tracking-wider text-black/60">
                  Replenish Amount ($)
                </Label>
                <div className="relative">
                  <Input
                    id="auto-amount"
                    type="number"
                    inputMode="decimal"
                    min={5}
                    max={500}
                    step={"1"}
                    value={autoAmount}
                    onChange={(e) => setAutoAmount(e.target.value)}
                    onBlur={() => autoEnabled && saveAutoSettings(true)}
                    className="bg-[#F2F0EB] border-black/20 mono text-xs"
                  />
                </div>
              </div>
            </div>

            {status?.hasSavedCard && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={managePortal} className="border-black/20 mono text-[10px] uppercase tracking-wider">
                  <ExternalLink className="h-3 w-3 mr-1" /> Manage Polar Billing Portal
                </Button>
              </div>
            )}
          </div>
        </div>

        <aside className="h-fit border border-black/10 bg-[#FAF8F5] p-5 sm:p-6 shadow-sm lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b-2 border-dashed border-black/10 pb-3 mb-4">
            <span className="mono text-xs font-semibold uppercase tracking-wider text-black flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Order Summary
            </span>
            <span className="mono text-[10px] bg-[#D4E157] px-1.5 py-0.2 font-bold text-black">SECURE</span>
          </div>
          <div className="space-y-2 mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-black/60">Charge amount</span>
              <span className="font-semibold text-black">${amount.toFixed(2)}</span>
            </div>
            {bonus > 0 && (
              <div className="flex items-center justify-between text-[#2A382E]">
                <span>Complimentary bonus</span>
                <span className="font-semibold">+${bonus.toFixed(2)}</span>
              </div>
            )}
            <div className="my-3 border-t border-black/10" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-black">Gross Credits</span>
              <span className="serif text-xl font-semibold text-black">${total.toFixed(2)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-black/50 font-light">
            Estimated capacity: ~{minutesEstimate.toLocaleString()} minutes of live voice routing.
          </p>
          <Button
            className="mt-5 w-full bg-[#1C1C1B] text-[#F2F0EB] hover:bg-black mono text-xs uppercase tracking-wider py-6"
            onClick={checkout}
            disabled={loading}
          >
            <Lock className="h-3.5 w-3.5 mr-1.5" />
            {loading ? "INITIALIZING SECURE CHECKOUT…" : `PURCHASE ${selectedPkg.label} →`}
          </Button>
          <ul className="mt-5 space-y-2 mono text-[10px] text-black/60 border-t border-black/10 pt-4">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-black/70 shrink-0" />
              Powered by Polar (Merchant of Record)
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-black/70 shrink-0" /> Credits never expire
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-black/70 shrink-0" /> Realtime per-second settlement
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
