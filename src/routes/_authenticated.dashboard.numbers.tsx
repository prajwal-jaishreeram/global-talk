import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Hash,
  Search,
  ShoppingCart,
  Trash2,
  Phone,
  Forward,
  Check,
  Settings2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";
import {
  searchAvailableNumbers,
  listMyPhoneNumbers,
  releasePhoneNumber,
  updatePhoneNumberForwarding,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryFlag } from "@/components/country-flag";
import { ConfirmAction } from "@/components/confirm-action";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/numbers")({
  head: () => ({ meta: [{ title: "Phone numbers - Ringringa" }] }),
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
  forward_to_number?: string | null;
  forward_sms_enabled?: boolean;
  created_at: string;
};

const COUNTRIES: { code: string; label: string; dial: string; areaExample: string }[] = [
  { code: "US", label: "United States", dial: "+1", areaExample: "415" },
  { code: "CA", label: "Canada", dial: "+1", areaExample: "416" },
  { code: "GB", label: "United Kingdom", dial: "+44", areaExample: "20" },
  { code: "GR", label: "Greece", dial: "+30", areaExample: "21" },
  { code: "AU", label: "Australia", dial: "+61", areaExample: "2" },
  { code: "DE", label: "Germany", dial: "+49", areaExample: "30" },
  { code: "FR", label: "France", dial: "+33", areaExample: "1" },
  { code: "NL", label: "Netherlands", dial: "+31", areaExample: "20" },
  { code: "IN", label: "India", dial: "+91", areaExample: "11" },
];

function NumbersPage() {
  const { ready, user } = useAuthState();
  const search = useServerFn(searchAvailableNumbers);
  const createOrder = useServerFn(createNumberOrder);
  const verifyOrder = useServerFn(verifyAndProvisionNumber);
  const cancelOrder = useServerFn(cancelPendingNumberOrder);
  const listMine = useServerFn(listMyPhoneNumbers);
  const releaseFn = useServerFn(releasePhoneNumber);
  const updateForwarding = useServerFn(updatePhoneNumberForwarding);

  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Available[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const [owned, setOwned] = useState<Owned[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(true);

  // SMS Forwarding configuration state (multi-number support)
  const [expandedForwardId, setExpandedForwardId] = useState<string | null>(null);
  const [forwardInputs, setForwardInputs] = useState<
    Record<string, { numbers: string[]; newNumber: string; enabled: boolean }>
  >({});
  const [savingForwardId, setSavingForwardId] = useState<string | null>(null);

  function parseNumbersList(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
      .split(/[,;\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function refreshOwned() {
    setLoadingOwned(true);
    try {
      const res = await listMine();
      const numbers = (res.numbers as Owned[]) ?? [];
      setOwned(numbers);

      // Seed local forward inputs
      const inputs: Record<
        string,
        { numbers: string[]; newNumber: string; enabled: boolean }
      > = {};
      for (const n of numbers) {
        inputs[n.id] = {
          numbers: parseNumbersList(n.forward_to_number),
          newNumber: "",
          enabled: Boolean(n.forward_sms_enabled),
        };
      }
      setForwardInputs(inputs);
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
    setHasSearched(true);
    setSearchNote(null);
    try {
      const trimmedAreaCode = areaCode.trim();
      const selectedCountry = COUNTRIES.find((c) => c.code === country);
      const countryLabel = selectedCountry?.label ?? country;
      const res = await search({ data: { country, areaCode: trimmedAreaCode, limit: 20 } });
      setResults(res.numbers as Available[]);
      if (res.relaxedAreaCode && res.requestedAreaCode) {
        const note = `No numbers matched area code ${res.requestedAreaCode}; showing available ${countryLabel} numbers instead.`;
        setSearchNote(note);
        toast.message("Showing country-wide results", { description: note });
      } else if (res.numbers.length === 0) {
        const note = trimmedAreaCode
          ? `No ${countryLabel} numbers are currently available for area code ${trimmedAreaCode}. Try clearing the area code.`
          : `No ${countryLabel} numbers are currently available from the voice provider. Try another country or check again later.`;
        setSearchNote(note);
        toast.message("No numbers matched your search", { description: note });
      }
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
              // User closed the modal - cancel the pending row.
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
    try {
      await releaseFn({ data: { id } });
      setOwned((os) => os.filter((o) => o.id !== id));
      toast.success("Number released");
    } catch (e: any) {
      toast.error(e?.message ?? "Release failed");
    }
  }

  function addForwardTarget(nId: string, raw?: string) {
    const current = forwardInputs[nId] ?? { numbers: [], newNumber: "", enabled: false };
    const text = (raw !== undefined ? raw : current.newNumber).trim();
    if (!text) return;

    const parts = text.split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean);
    const next = [...current.numbers];
    for (let p of parts) {
      if (!p.startsWith("+")) p = `+${p.replace(/\D/g, "")}`;
      const digitsOnly = p.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 16) {
        toast.error(`"${p}" is invalid. Please include country code.`);
        continue;
      }
      if (!next.includes(p)) next.push(p);
    }

    setForwardInputs((prev) => ({
      ...prev,
      [nId]: {
        ...current,
        numbers: next,
        newNumber: "",
      },
    }));
  }

  function removeForwardTarget(nId: string, index: number) {
    const current = forwardInputs[nId] ?? { numbers: [], newNumber: "", enabled: false };
    setForwardInputs((prev) => ({
      ...prev,
      [nId]: {
        ...current,
        numbers: current.numbers.filter((_, i) => i !== index),
      },
    }));
  }

  async function saveForwarding(n: Owned) {
    setSavingForwardId(n.id);
    const current = forwardInputs[n.id] ?? { numbers: [], newNumber: "", enabled: false };
    let finalNumbers = [...current.numbers];
    if (current.newNumber.trim()) {
      let p = current.newNumber.trim();
      if (!p.startsWith("+")) p = `+${p.replace(/\D/g, "")}`;
      if (/^\+\d{7,16}$/.test(p) && !finalNumbers.includes(p)) {
        finalNumbers.push(p);
      }
    }

    if (current.enabled && finalNumbers.length === 0) {
      toast.error("Please add at least one forwarding phone number before enabling auto-forwarding.");
      setSavingForwardId(null);
      return;
    }

    try {
      const res = await updateForwarding({
        data: {
          id: n.id,
          forward_to_number: finalNumbers.length > 0 ? finalNumbers.join(", ") : null,
          forward_sms_enabled: current.enabled,
        },
      });

      setOwned((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? {
                ...item,
                forward_to_number: res.forward_to_number,
                forward_sms_enabled: res.forward_sms_enabled,
              }
            : item,
        ),
      );
      setForwardInputs((prev) => ({
        ...prev,
        [n.id]: {
          numbers: finalNumbers,
          newNumber: "",
          enabled: current.enabled,
        },
      }));
      toast.success(
        current.enabled && finalNumbers.length > 0
          ? `Forwarding saved for ${finalNumbers.length} number${finalNumbers.length > 1 ? "s" : ""}!`
          : "SMS forwarding disabled",
      );
      setExpandedForwardId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update forwarding");
    } finally {
      setSavingForwardId(null);
    }
  }

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const selectedDial = selectedCountry?.dial ?? "+1";

  function handleCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    setAreaCode("");
    setResults([]);
    setHasSearched(false);
    setSearchNote(null);
  }

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
            <Select value={country} onValueChange={handleCountryChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="group">
                    <CountryFlag code={c.code} className="mr-2" />
                    <span className="w-6 text-xs font-semibold text-foreground group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground">
                      {c.code}
                    </span>{" "}
                    <span className="font-mono text-xs font-semibold text-foreground/85 group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground">
                      {c.dial}
                    </span>
                    <span className="ml-1 truncate font-medium text-foreground/90 group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground">
                      {c.label}
                    </span>
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
                placeholder={`Leave blank for widest search (e.g. ${selectedCountry?.areaExample ?? "20"})`}
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
      {(searching || hasSearched) && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="bg-muted/40 px-5 py-3 text-sm font-medium">Available Numbers</div>
          <ul className="divide-y divide-border/60">
            {searching ? (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">Searching…</li>
            ) : results.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                {searchNote ?? "No numbers matched your search."}
              </li>
            ) : (
              <>
                {searchNote && (
                  <li className="bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
                    {searchNote}
                  </li>
                )}
                {results.map((n) => (
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
                    <Button size="sm" onClick={() => buy(n)} disabled={buying === n.phone_number}>
                      <ShoppingCart />
                      {buying === n.phone_number ? "Buying…" : "Buy"}
                    </Button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}

      {/* Owned */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your numbers</h2>
            <p className="text-xs text-muted-foreground">
              Manage numbers, incoming calls, and auto-forwarding to any mobile phone worldwide.
            </p>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {loadingOwned ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : owned.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              You don't own any numbers yet. Buy one above to start receiving calls and SMS.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {owned.map((n) => {
                const isExpanded = expandedForwardId === n.id;
                const forwardState = forwardInputs[n.id] ?? {
                  numbers: parseNumbersList(n.forward_to_number),
                  newNumber: "",
                  enabled: Boolean(n.forward_sms_enabled),
                };
                const displayNumbers = parseNumbersList(n.forward_to_number);

                return (
                  <li key={n.id} className="flex flex-col px-5 py-4 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                          <Phone className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatNumber(n.phone_number)}</span>
                            {n.forward_sms_enabled && displayNumbers.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {displayNumbers.length === 1
                                  ? `Forwarding to ${displayNumbers[0]}`
                                  : `Forwarding to ${displayNumbers.length} numbers`}
                              </span>
                            ) : (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                Forwarding Off
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {n.country_code ?? "N/A"} · ${Number(n.monthly_cost).toFixed(2)}/month · {n.status}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={isExpanded ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setExpandedForwardId(isExpanded ? null : n.id)}
                          className="gap-1.5 text-xs"
                        >
                          <Forward className="h-3.5 w-3.5 text-primary" />
                          <span>Forward SMS</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>

                        <ConfirmAction
                          title="Release phone number?"
                          description="This removes the number from your voice account and stops future billing for it."
                          confirmLabel="Release number"
                          tone="destructive"
                          onConfirm={() => void release(n.id)}
                        >
                          <button
                            type="button"
                            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Release"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </ConfirmAction>
                      </div>
                    </div>

                    {/* Forwarding Settings Drawer/Card */}
                    {isExpanded && (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                              <Forward className="h-4 w-4 text-primary" />
                              SMS Auto-Forwarding Settings
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Automatically forward all incoming text messages & OTPs sent to{" "}
                              <span className="font-semibold text-foreground">
                                {formatNumber(n.phone_number)}
                              </span>{" "}
                              directly to one or multiple external mobile numbers in the world.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <Switch
                              id={`switch-${n.id}`}
                              checked={forwardState.enabled}
                              onCheckedChange={(val) =>
                                setForwardInputs((prev) => ({
                                  ...prev,
                                  [n.id]: {
                                    ...forwardState,
                                    enabled: val,
                                  },
                                }))
                              }
                            />
                            <Label htmlFor={`switch-${n.id}`} className="text-xs font-medium cursor-pointer">
                              {forwardState.enabled
                                ? "Auto-Forwarding is Active"
                                : "Auto-Forwarding is Disabled"}
                            </Label>
                          </div>

                          {/* Forwarding list chips */}
                          {forwardState.numbers.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">Forwarding to:</span>
                              {forwardState.numbers.map((targetNum, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-foreground"
                                >
                                  <Phone className="h-3 w-3 text-primary" />
                                  <span>{targetNum}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeForwardTarget(n.id, idx)}
                                    className="rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 text-muted-foreground transition-colors ml-0.5"
                                    title="Remove"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                              {forwardState.numbers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForwardInputs((prev) => ({
                                      ...prev,
                                      [n.id]: { ...forwardState, numbers: [] },
                                    }))
                                  }
                                  className="text-[11px] text-muted-foreground hover:text-destructive underline ml-1"
                                >
                                  Clear all
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs italic text-muted-foreground">
                              No forwarding numbers added yet. Add below.
                            </p>
                          )}

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex flex-1 items-center gap-2 max-w-md">
                              <Input
                                value={forwardState.newNumber}
                                onChange={(e) =>
                                  setForwardInputs((prev) => ({
                                    ...prev,
                                    [n.id]: {
                                      ...forwardState,
                                      newNumber: e.target.value,
                                    },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addForwardTarget(n.id);
                                  }
                                }}
                                placeholder="e.g. +91 8605222604 or +1 415 555 2671"
                                className="text-xs bg-background"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addForwardTarget(n.id)}
                                disabled={!forwardState.newNumber.trim()}
                                className="gap-1 text-xs shrink-0"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                              </Button>
                            </div>

                            <div className="flex gap-2 sm:ml-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedForwardId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={savingForwardId === n.id}
                                onClick={() => saveForwarding(n)}
                              >
                                {savingForwardId === n.id ? (
                                  "Saving…"
                                ) : (
                                  <>
                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                    Save Forwarding
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          <p className="text-[11px] text-muted-foreground">
                            You can add multiple phone numbers. Incoming SMS/OTPs will be forwarded simultaneously to all of them.
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
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
