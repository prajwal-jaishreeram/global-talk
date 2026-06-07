import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Hash, Search, ShoppingCart, Trash2, Phone } from "lucide-react";
import {
  searchAvailableNumbers,
  listMyPhoneNumbers,
  releasePhoneNumber,
} from "@/lib/telnyx.functions";
import {
  createNumberOrder,
  verifyAndProvisionNumber,
  cancelPendingNumberOrder,
} from "@/lib/razorpay.functions";
import { useAuthState } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryFlag } from "@/components/country-flag";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/numbers")({
  head: () => ({ meta: [{ title: "Phone numbers — Ringringa" }] }),
  component: NumbersPage,
});

type Available = {
  phone_number: string;
  monthly_cost: number;
  currency: string;
  region: string | null;
};

type Owned = {
  id: string;
  phone_number: string;
  country_code: string | null;
  monthly_cost: number;
  status: string;
  created_at: string;
};

const COUNTRIES: { code: string; label: string; dial: string }[] = [
  { code: "US", label: "United States", dial: "+1" },
  { code: "CA", label: "Canada", dial: "+1" },
  { code: "GB", label: "United Kingdom", dial: "+44" },
  { code: "AU", label: "Australia", dial: "+61" },
  { code: "DE", label: "Germany", dial: "+49" },
  { code: "FR", label: "France", dial: "+33" },
  { code: "NL", label: "Netherlands", dial: "+31" },
  { code: "IN", label: "India", dial: "+91" },
];

function NumbersPage() {
  const { ready, user } = useAuthState();
  const search = useServerFn(searchAvailableNumbers);
  const createOrder = useServerFn(createNumberOrder);
  const verifyOrder = useServerFn(verifyAndProvisionNumber);
  const cancelOrder = useServerFn(cancelPendingNumberOrder);
  const listMine = useServerFn(listMyPhoneNumbers);
  const releaseFn = useServerFn(releasePhoneNumber);

  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Available[]>([]);
  const [buying, setBuying] = useState<string | null>(null);

  const [owned, setOwned] = useState<Owned[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(true);

  async function refreshOwned() {
    setLoadingOwned(true);
    try {
      const res = await listMine();
      setOwned((res.numbers as Owned[]) ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load numbers");
    } finally {
      setLoadingOwned(false);
    }
  }

  useEffect(() => {
    if (ready && user) void refreshOwned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function runSearch() {
    setSearching(true);
    setResults([]);
    try {
      const res = await search({ data: { country, areaCode, limit: 20 } });
      setResults(res.numbers as Available[]);
      if (res.numbers.length === 0) toast.message("No numbers matched your search");
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function buy(num: Available) {
    setBuying(num.phone_number);
    try {
      // 1. Ensure the Razorpay Checkout script is loaded.
      await loadRazorpayScript();
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Could not load Razorpay checkout");

      // 2. Create the order on our server (also creates a pending DB row).
      const order = await createOrder({
        data: { phoneNumber: num.phone_number, country },
      });

      // 3. Open the Razorpay payment modal.
      await new Promise<void>((resolve, reject) => {
        const rzp = new Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "Ringringa",
          description: `Phone number ${num.phone_number}`,
          prefill: { email: order.prefillEmail },
          theme: { color: "#3b82f6" },
          modal: {
            ondismiss: () => {
              // User closed the modal — cancel the pending row.
              cancelOrder({ data: { rowId: order.rowId } }).catch(() => {});
              reject(new Error("Payment cancelled"));
            },
          },
          handler: async (resp: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyOrder({ data: resp });
              resolve();
            } catch (e: any) {
              reject(e);
            }
          },
        });
        rzp.on("payment.failed", (e: any) => {
          cancelOrder({ data: { rowId: order.rowId } }).catch(() => {});
          reject(new Error(e?.error?.description ?? "Payment failed"));
        });
        rzp.open();
      });

      toast.success(`Purchased ${num.phone_number}`);
      setResults((rs) => rs.filter((r) => r.phone_number !== num.phone_number));
      await refreshOwned();
    } catch (e: any) {
      if (e?.message && e.message !== "Payment cancelled") {
        toast.error(e.message);
      }
    } finally {
      setBuying(null);
    }
  }

  async function release(id: string) {
    if (
      !confirm(
        "Release this number? This removes it from your voice account too, so you'll stop being billed for it.",
      )
    )
      return;
    try {
      await releaseFn({ data: { id } });
      setOwned((os) => os.filter((o) => o.id !== id));
      toast.success("Number released");
    } catch (e: any) {
      toast.error(e?.message ?? "Release failed");
    }
  }

  const selectedDial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+1";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Purchase a new phone number to make and receive calls.
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Supporting documents might be required by our customer support team.
      </p>

      {/* Search */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <CountryFlag code={c.code} className="mr-2" />
                    <span className="w-6 text-xs font-semibold text-foreground">{c.code}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{c.dial}</span>{" "}
                    <span className="text-muted-foreground">— {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="area" className="text-xs text-muted-foreground">
              Area code <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative mt-1.5">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="area"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                placeholder={`Enter area code (e.g. ${country === "US" ? "415" : "20"})`}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
          </div>
          <Button onClick={runSearch} disabled={searching}>
            <Search />
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Dialing prefix for {country}: <span className="font-medium">{selectedDial}</span>
        </p>
      </div>

      {/* Available results */}
      {(searching || results.length > 0) && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="bg-muted/40 px-5 py-3 text-sm font-medium">Available Numbers</div>
          <ul className="divide-y divide-border/60">
            {searching ? (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">Searching…</li>
            ) : (
              results.map((n) => (
                <li
                  key={n.phone_number}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <div className="font-medium">{formatNumber(n.phone_number)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      ${n.monthly_cost.toFixed(2)}/month
                      {n.region && <> · {n.region}</>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => buy(n)}
                    disabled={buying === n.phone_number}
                  >
                    <ShoppingCart />
                    {buying === n.phone_number ? "Buying…" : "Buy"}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Owned */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Your numbers</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {loadingOwned ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : owned.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              You don't own any numbers yet. Buy one above to start receiving calls.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {owned.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium">{formatNumber(n.phone_number)}</div>
                      <div className="text-xs text-muted-foreground">
                        {n.country_code ?? "—"} · ${Number(n.monthly_cost).toFixed(2)}/month · {n.status}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => release(n.id)}
                    className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Release"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Lazily inject the Razorpay Checkout SDK script on first use. Resolves
// immediately on subsequent calls.
let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error("Failed to load Razorpay script"));
    };
    document.head.appendChild(s);
  });
  return razorpayScriptPromise;
}

function formatNumber(e164: string) {
  if (e164.startsWith("+1") && e164.length === 12) {
    return `+1 ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
  }
  return e164;
}
