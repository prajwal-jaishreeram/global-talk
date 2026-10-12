import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { ChevronDown, HelpCircle, Phone, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CountryFlag } from "@/components/country-flag";
import { DEFAULT_RATE, VOICE_RATES } from "@/lib/rates";
import { cn } from "@/lib/utils";

type RateCalculatorProps = {
  showTeamCta?: boolean;
  primaryHref?: string;
  primaryLabel?: (countryName: string) => string;
  title?: string;
  description?: string;
};

export function RateCalculator({
  showTeamCta = true,
  primaryHref = "/auth/signup",
  primaryLabel = (countryName) => `Call ${countryName} now`,
  title = "Calculate Your Call Cost",
  description = "Transparent per-minute pricing for over 200 countries.",
}: RateCalculatorProps) {
  const [country, setCountry] = useState("US");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"mobile" | "landline">("mobile");

  const countries = useMemo(
    () =>
      getCountries()
        .map((c) => {
          const name =
            (typeof Intl !== "undefined" && "DisplayNames" in Intl
              ? new Intl.DisplayNames(["en"], { type: "region" }).of(c)
              : c) ?? c;
          return { code: c, name, dial: getCountryCallingCode(c) };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const current = countries.find((c) => c.code === country) ?? countries[0];
  const entry = VOICE_RATES[country];
  const rate = entry ? entry[type].retail : DEFAULT_RATE;

  return (
    <>
      <div className="text-center max-w-2xl mx-auto">
        <div className="mono text-[11px] mb-4 text-[#8B6B55] font-bold uppercase tracking-widest">
          ◆ REALTIME ROUTING INDEX
        </div>
        <h1 className="serif text-4xl sm:text-5xl font-light tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-base text-muted-foreground font-light leading-relaxed">{description}</p>
      </div>

      {showTeamCta && (
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-3 border border-border bg-card dark:bg-[#16161B] px-4 py-2 shadow-2xs">
            <span className="mono text-xs text-muted-foreground">Need programmatic high-volume capacity?</span>
            <Link to="/contact">
              <Button size="sm" className="bg-foreground text-background hover:opacity-90 mono text-[11px] uppercase tracking-wider h-7 cursor-pointer">
                API Concierge →
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 border border-border bg-card dark:bg-[#16161B] p-6 md:grid-cols-[1fr_auto] md:p-8 shadow-xs">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="mono text-xs uppercase tracking-wider text-muted-foreground w-24">Destination</span>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button className="flex min-w-[260px] items-center justify-between gap-2 border-b border-border bg-transparent px-2 py-2 text-left text-base hover:border-foreground transition-colors cursor-pointer">
                  <span className="flex min-w-0 items-center gap-2">
                    <CountryFlag code={current.code} />
                    <span className="mono text-xs font-semibold text-foreground">
                      {current.code}
                    </span>
                    <span className="truncate font-medium text-foreground">{current.name}</span>
                    <span className="mono text-xs text-muted-foreground">
                      +{current.dial}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0 border-border bg-card" align="start">
                <Command className="bg-card">
                  <CommandInput placeholder="Search country..." className="mono text-xs" />
                  <CommandList>
                    <CommandEmpty className="mono text-xs p-3 text-muted-foreground">No country found.</CommandEmpty>
                    <CommandGroup>
                      {countries.map((c) => (
                        <CommandItem
                          key={c.code}
                          value={`${c.name} ${c.code} +${c.dial}`}
                          className="group cursor-pointer hover:bg-muted"
                          onSelect={() => {
                            setCountry(c.code);
                            setOpen(false);
                          }}
                        >
                          <CountryFlag code={c.code} className="mr-2" />
                          <span className="mono w-6 text-xs font-semibold text-foreground">
                            {c.code}
                          </span>
                          <span className="mono text-xs text-muted-foreground">
                            +{c.dial}
                          </span>
                          <span className="ml-3 flex-1 truncate text-xs font-medium text-foreground">
                            {c.name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="mono text-xs uppercase tracking-wider text-muted-foreground w-24">Line Type</span>
            <button
              onClick={() => setType("mobile")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 mono text-xs uppercase tracking-wider transition border cursor-pointer",
                type === "mobile"
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "bg-transparent text-foreground border-border hover:border-foreground",
              )}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
            <button
              onClick={() => setType("landline")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 mono text-xs uppercase tracking-wider transition border cursor-pointer",
                type === "landline"
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "bg-transparent text-foreground border-border hover:border-foreground",
              )}
            >
              <Phone className="h-3.5 w-3.5" /> Landline
            </button>
          </div>
        </div>

        <div className="flex min-w-[240px] flex-col items-center justify-center border border-border bg-white dark:bg-[#0D0D11] p-6 text-center shadow-2xs">
          <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">ESTIMATED RATE</div>
          <div className="mt-2 text-4xl serif font-light text-foreground">
            ${rate.toFixed(rate < 0.1 ? 3 : 2)}
          </div>
          <span className="mono text-[11px] text-muted-foreground mt-1">USD per minute</span>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <a href={primaryHref}>
          <Button size="lg" className="bg-foreground text-background hover:opacity-90 mono text-xs uppercase tracking-widest px-8 py-6 cursor-pointer">
            {primaryLabel(current.name)} →
          </Button>
        </a>
      </div>

      <div className="mt-14 border border-border bg-card dark:bg-[#16161B] p-6 md:p-8">
        <div className="flex items-center justify-between border-b-2 border-dashed border-border pb-3 mb-6">
          <h2 className="mono text-xs uppercase tracking-widest text-foreground/80 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Routing & Billing Specifications
          </h2>
          <span className="mono text-[10px] text-muted-foreground">AUDITED_PSTN</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mono text-xs font-semibold uppercase tracking-wider text-foreground">Per-Second Micro-Settlement</h3>
            <p className="mt-1.5 text-xs text-muted-foreground font-light leading-relaxed">
              No minute rounding penalties. Exact duration is calculated in seconds and deducted directly from your account balance with cryptographic audit log verification.
            </p>
          </div>
          <div>
            <h3 className="mono text-xs font-semibold uppercase tracking-wider text-foreground">Direct Carrier Routing</h3>
            <p className="mt-1.5 text-xs text-muted-foreground font-light leading-relaxed">
              Traffic is handled via premium Telnyx tier-1 PSTN interconnects to guarantee immediate setup, crystal audio quality, and ultra-low latency.
            </p>
          </div>
          <div>
            <h3 className="mono text-xs font-semibold uppercase tracking-wider text-foreground">Safety & Blocklists</h3>
            <p className="mt-1.5 text-xs text-muted-foreground font-light leading-relaxed">
              Emergency numbers (911, 112, 999) and premium extortion-rate destinations are blocked at the engine gateway to keep your AI agents completely compliant.
            </p>
          </div>
          <div>
            <h3 className="mono text-xs font-semibold uppercase tracking-wider text-foreground">Mobile vs. Landline Pricing</h3>
            <p className="mt-1.5 text-xs text-muted-foreground font-light leading-relaxed">
              Mobile termination varies by local telecom tariffs. Our real-time engine maps your destination number and locks the lowest available wholesale route.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
