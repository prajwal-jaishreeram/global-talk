import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Phone, Delete, Info } from "lucide-react";
import { AsYouType, parsePhoneNumberFromString, getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRateForNumber, formatCurrency } from "@/lib/rates";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Dialer — Ringlink" }] }),
  component: DialerPage,
});

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", IN: "India", DE: "Germany",
  FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", AU: "Australia",
  JP: "Japan", CN: "China", BR: "Brazil", MX: "Mexico", AE: "UAE", SG: "Singapore",
};

function DialerPage() {
  const [country, setCountry] = useState("US");
  const [raw, setRaw] = useState("");

  const countries = useMemo(() => {
    const all = getCountries();
    // Prefer named ones first then the rest alphabetically by code
    const named = all.filter((c) => COUNTRY_NAMES[c]).sort();
    const rest = all.filter((c) => !COUNTRY_NAMES[c]).sort();
    return [...named, ...rest];
  }, []);

  const callingCode = getCountryCallingCode(country as never);
  const e164 = `+${callingCode}${raw.replace(/\D/g, "")}`;
  const parsed = parsePhoneNumberFromString(e164);
  const formatted = parsed ? new AsYouType(country as never).input(raw) : raw;
  const isValid = parsed?.isValid() ?? false;
  const { rate, country: detected } = getRateForNumber(e164);

  function press(ch: string) {
    setRaw((r) => r + ch);
  }
  function backspace() {
    setRaw((r) => r.slice(0, -1));
  }

  function startCall() {
    if (!isValid) return toast.error("Enter a valid number");
    toast.info("Calling is not yet activated", {
      description: "Connecting carrier credentials is the final setup step.",
    });
  }

  const keys = ["1","2","3","4","5","6","7","8","9","*","0","#"];

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Make a call</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dial any international number. Credits deduct per second.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex gap-2">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c} +{getCountryCallingCode(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={formatted}
            onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
            placeholder="Phone number"
            inputMode="tel"
            className="text-lg font-medium tracking-wider"
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{detected ? `${COUNTRY_NAMES[detected] ?? detected}` : "Unknown destination"}</span>
          <span className="inline-flex items-center gap-1">
            <Info className="h-3 w-3" /> {formatCurrency(rate)}/min
          </span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="aspect-square rounded-2xl bg-secondary text-2xl font-medium text-secondary-foreground transition-colors hover:bg-secondary/70 active:scale-95"
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="w-12" />
          <Button
            size="lg"
            onClick={startCall}
            className="h-16 w-16 rounded-full p-0 shadow-lg"
            disabled={!isValid}
          >
            <Phone className="h-6 w-6" />
          </Button>
          <button
            onClick={backspace}
            className="grid h-12 w-12 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Delete"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}