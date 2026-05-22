import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { ChevronDown, Smartphone, Phone, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { RATES, DEFAULT_RATE } from "@/lib/rates";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/rates")({
  head: () => ({
    meta: [
      { title: "Rate Calculator - Eginta" },
      { name: "description", content: "Calculate per-minute rates for international calls with Eginta." },
    ],
  }),
  component: RatesPage,
});

function flagOf(c: string) {
  return String.fromCodePoint(
    ...c.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

function RatesPage() {
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
          return { code: c, name, dial: getCountryCallingCode(c), flag: flagOf(c) };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const current = countries.find((c) => c.code === country)!;
  const base = RATES[country] ?? DEFAULT_RATE;
  // Mobile rate slightly higher than landline in most countries
  const rate = type === "mobile" ? base : Math.max(0.01, base * 0.85);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-center text-4xl font-bold tracking-tight">Calculate Your Call Cost</h1>
      <p className="mt-3 text-center text-muted-foreground">
        Transparent per-minute pricing for over 200 countries.
      </p>

      <div className="mt-10 flex justify-center">
        <div className="flex items-center gap-3 rounded-full border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm">Need Eginta for the team?</span>
          <Link to="/contact">
            <Button size="sm" className="rounded-full">See enterprise plans</Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 rounded-3xl border border-primary/20 bg-primary/5 p-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="w-20 text-sm text-muted-foreground">I'm calling</span>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button className="flex min-w-[260px] items-center justify-between gap-2 border-b border-primary/40 bg-transparent px-2 py-2 text-left text-base hover:border-primary">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{current.flag}</span>
                    <span>{current.name}</span>
                    <span className="text-muted-foreground text-sm">+{current.dial}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-primary" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search country…" />
                  <CommandList>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {countries.map((c) => (
                        <CommandItem
                          key={c.code}
                          value={`${c.name} ${c.code} +${c.dial}`}
                          onSelect={() => { setCountry(c.code); setOpen(false); }}
                        >
                          <span className="mr-2 text-lg">{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="text-xs text-muted-foreground">+{c.dial}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 text-sm text-muted-foreground">To a</span>
            <button
              onClick={() => setType("mobile")}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${
                type === "mobile" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              <Smartphone className="h-4 w-4" /> Mobile
            </button>
            <button
              onClick={() => setType("landline")}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${
                type === "landline" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              <Phone className="h-4 w-4" /> Landline
            </button>
          </div>
        </div>

        <div className="flex min-w-[240px] flex-col items-center justify-center rounded-2xl bg-primary/15 p-6 text-center">
          <div className="text-sm text-muted-foreground">Your call will cost</div>
          <div className="mt-2 text-3xl font-bold">
            ${rate.toFixed(rate < 0.1 ? 3 : 2)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">per minute</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Link to="/auth/signup">
          <Button size="lg" className="rounded-full px-10 py-6 text-base font-semibold">
            Call {current.name} now
          </Button>
        </Link>
      </div>

      <div className="mt-12 rounded-2xl border border-border/60 bg-card p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-medium">How are international rates determined?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              International rates are based on carrier costs, network quality, and destination. We negotiate the best rates possible to offer competitive pricing.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Do rates change over time?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Yes, rates may change based on market conditions and carrier agreements. We always display the current rates before you place a call.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Are there any hidden fees?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No. The rate shown is exactly what you pay per minute, billed per second from your prepaid credit balance.
            </p>
          </div>
          <div>
            <h3 className="font-medium">What's the difference between mobile and landline?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              In most countries, mobile termination fees are slightly higher than landline. The calculator reflects the live rate for each type.
            </p>
          </div>
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
