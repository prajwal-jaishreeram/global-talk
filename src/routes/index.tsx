import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Phone, Globe, Zap, ShieldCheck, Delete, Briefcase, Headphones,
  CreditCard, Mic, MicOff, PhoneCall, PhoneOff, ChevronDown, Sparkles,
  Plus, UserPlus, Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import flagUS from "@/assets/flags/us.svg";
import flagGB from "@/assets/flags/gb.svg";
import flagIN from "@/assets/flags/in.svg";
import flagJP from "@/assets/flags/jp.svg";
import flagCA from "@/assets/flags/ca.svg";
import flagBS from "@/assets/flags/bs.svg";
import flagBD from "@/assets/flags/bd.svg";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ringlink - Browser-based international calling" },
      {
        name: "description",
        content:
          "Make low-cost international calls from your browser. Pay-as-you-go credits, crystal-clear HD audio, no app install.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <HeroDialer />
      <HowToCall />
      <ForBusiness />
      <WhyChooseUs />
      <FAQ />
      <SiteFooter />
    </div>
  );
}


function HeroDialer() {
  return <HeroDialerInner />;
}

function FlagChip({
  src,
  name,
  rate,
  className,
}: {
  src: string;
  name: string;
  rate: string;
  className?: string;
}) {
  return (
    <div
      className={`z-10 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-2.5 py-1.5 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/30 ${className ?? ""}`}
    >
      <img src={src} alt={`${name} flag`} className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40" />
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold text-foreground">{name}</span>
        <span className="text-[9px] tracking-wide text-muted-foreground">{rate}</span>
      </div>
    </div>
  );
}

function HeroDialerInner() {
  const [number, setNumber] = useState("");
  const [state, setState] = useState<"idle" | "connecting">("idle");
  const [muted, setMuted] = useState(false);
  const [country, setCountry] = useState("US");
  const [countryOpen, setCountryOpen] = useState(false);
  const [alpha, setAlpha] = useState(false);
  const timerRef = useRef<number | null>(null);
  const multitapRef = useRef<{ k: string; idx: number; time: number } | null>(null);
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const countries = useState(() =>
    getCountries()
      .map((c) => {
        const dial = getCountryCallingCode(c);
        const flag = String.fromCodePoint(
          ...c.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
        );
        const name =
          (typeof Intl !== "undefined" && "DisplayNames" in Intl
            ? new Intl.DisplayNames(["en"], { type: "region" }).of(c)
            : c) ?? c;
        return { code: c, dial, flag, name };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  )[0];
  const callingCode = getCountryCallingCode(country as never);
  const currentFlag = String.fromCodePoint(
    ...country.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
  const keys: { d: string; sub?: string }[] = [
    { d: "1" },
    { d: "2", sub: "ABC" },
    { d: "3", sub: "DEF" },
    { d: "4", sub: "GHI" },
    { d: "5", sub: "JKL" },
    { d: "6", sub: "MNO" },
    { d: "7", sub: "PQRS" },
    { d: "8", sub: "TUV" },
    { d: "9", sub: "WXYZ" },
    { d: "*" },
    { d: "0", sub: "+" },
    { d: "#" },
  ];
  const press = (digit: string, sub?: string) => {
    if (alpha && sub) {
      const now = Date.now();
      const last = multitapRef.current;
      if (last && last.k === digit && now - last.time < 900) {
        const idx = (last.idx + 1) % sub.length;
        multitapRef.current = { k: digit, idx, time: now };
        setNumber((n) => (n.slice(0, -1) + sub[idx]).slice(0, 24));
      } else {
        multitapRef.current = { k: digit, idx: 0, time: now };
        setNumber((n) => (n + sub[0]).slice(0, 24));
      }
      return;
    }
    multitapRef.current = null;
    setNumber((n) => (n + digit).slice(0, 24));
  };
  const back = () => setNumber((n) => n.slice(0, -1));

  async function startCall() {
    if (!number) return;
    setState("connecting");
    const { data } = await supabase.auth.getSession();
    timerRef.current = window.setTimeout(() => {
      const target = `/dashboard?to=${encodeURIComponent("+" + callingCode + number)}`;
      window.location.href = data.session
        ? target
        : `/auth/signup?redirect=${encodeURIComponent(target)}`;
    }, 900);
  }
  function endCall() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setState("idle");
    setMuted(false);
  }

  const inCall = state !== "idle";

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-[360px] w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-[80px]" />
        {/* Floating background flag strip */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between gap-6 px-4 opacity-25 dark:opacity-20">
          {[
            { src: flagUS, d: "0s" },
            { src: flagGB, d: "-1.2s" },
            { src: flagCA, d: "-2.4s" },
            { src: flagIN, d: "-3.6s" },
            { src: flagJP, d: "-4.8s" },
            { src: flagBD, d: "-6s" },
            { src: flagBS, d: "-7.2s" },
          ].map((f, i) => (
            <img
              key={i}
              src={f.src}
              alt=""
              aria-hidden
              className="h-20 w-20 md:h-28 md:w-28 lg:h-36 lg:w-36 shrink-0 rounded-full object-cover shadow-lg animate-float"
              style={{ animationDelay: f.d }}
            />
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-2 md:py-16 md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Browser-native calling
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Dial the world,
            <br />
            <span className="text-primary">right from your tab.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            HD international calls powered by a tier-1 carrier network. Pay only for what you use - no apps, no contracts, no SIM swaps.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/auth/signup">
              <Button size="lg" className="text-base">Start with $5 free credit</Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline" className="text-base">See how it works</Button>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> 200+ countries</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> TLS + SRTP</div>
            <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Sub-second connect</div>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="relative mx-auto w-full max-w-[440px] py-6">
          {/* Soft glow halo behind the phone */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl"
          />
          <div className="relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border-2 border-border bg-card p-3 shadow-xl shadow-black/20 dark:shadow-black/40">
            <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted" />
            <div className="rounded-[2rem] bg-background p-4">
              {/* Top bar: balance + status dot */}
              <div className="flex items-center justify-between">
                <Link
                  to="/dashboard/credits"
                  className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/25"
                >
                  Balance: $5.00
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Plus className="h-3 w-3" />
                  </span>
                </Link>
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              </div>

              {/* Number row */}
              <div className="mt-5 flex items-center gap-2">
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <span className="text-base leading-none">{currentFlag}</span>
                      <span>+{callingCode}</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const q = search.toLowerCase().replace(/^\+/, "");
                        return value.toLowerCase().includes(q) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Search country or +code…" />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {countries.map((c) => (
                            <CommandItem
                              key={c.code}
                              value={`${c.name} ${c.code} +${c.dial}`}
                              onSelect={() => { setCountry(c.code); setCountryOpen(false); }}
                            >
                              <span className="mr-2 text-base leading-none">{c.flag}</span>
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">+{c.dial}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="flex-1 truncate border-b border-border pb-1 text-left font-mono text-base text-foreground">
                  {number || <span className="text-muted-foreground font-sans">Enter phone number</span>}
                </div>
                <button onClick={back} className="text-muted-foreground hover:text-foreground" aria-label="Backspace">
                  <Delete className="h-4 w-4" />
                </button>
              </div>

              {/* Status / Add contact */}
              <div className="mt-3 flex h-6 items-center justify-center">
                {inCall ? (
                  <span className="text-xs text-muted-foreground">Connecting…</span>
                ) : (
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                    <UserPlus className="h-3 w-3" /> Add contact
                  </button>
                )}
              </div>

              {/* Keypad */}
              <div className="mt-4 grid grid-cols-3 place-items-center gap-y-2">
                {keys.map((k) => (
                  <button
                    key={k.d}
                    onClick={() => press(k.d, k.sub)}
                    className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-muted/70 transition hover:bg-muted active:scale-95"
                  >
                    <span className="text-lg font-semibold leading-none">
                      {alpha && k.sub ? k.sub : k.d}
                    </span>
                    {!alpha && k.sub && (
                      <span className="mt-0.5 text-[9px] tracking-[0.15em] text-muted-foreground">{k.sub}</span>
                    )}
                    {alpha && k.sub && (
                      <span className="mt-0.5 text-[9px] tracking-[0.15em] text-muted-foreground">{k.d}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Bottom action row */}
              <div className="mt-3 grid grid-cols-3 place-items-center">
                {inCall ? (
                  <button
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="grid h-10 w-10 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted"
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                ) : (
                  <button
                    onClick={() => setAlpha((a) => !a)}
                    aria-label="Toggle letters"
                    className="grid h-10 w-10 place-items-center rounded-full bg-muted/70 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    {alpha ? "123" : "ABC"}
                  </button>
                )}
                {inCall ? (
                  <button
                    onClick={endCall}
                    aria-label="End call"
                    className="grid h-14 w-14 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition hover:opacity-90 active:scale-95"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>
                ) : (
                  <button
                    onClick={startCall}
                    disabled={!number}
                    aria-label="Call"
                    className="grid h-14 w-14 place-items-center rounded-full bg-call text-call-foreground shadow-lg shadow-call/30 transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                  >
                    <PhoneCall className="h-6 w-6" />
                  </button>
                )}
                {inCall ? (
                  <button
                    aria-label="Speaker"
                    className="grid h-10 w-10 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={back}
                    aria-label="Backspace"
                    className="grid h-10 w-10 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Live preview - sign up to dial for real.</p>
        </div>
      </div>
    </section>
  );
}

function HowToCall() {
  const steps = [
    { icon: CreditCard, title: "Create your account", body: "Sign up in 30 seconds and grab $5 in trial credit. No card required." },
    { icon: Mic, title: "Allow microphone", body: "Your browser asks once. We never record - audio streams peer-to-peer over SRTP." },
    { icon: PhoneCall, title: "Dial & connect", body: "Type any international number, hit call. The phone rings in under a second." },
  ];
  return (
    <section id="how" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How to make a call</h2>
          <p className="mt-3 text-muted-foreground">Three steps. No installs, no plugins, no learning curve.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-mono text-muted-foreground">0{i+1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForBusiness() {
  const points = [
    "Centralised billing across your whole team",
    "Per-seat call history & exportable CDRs",
    "Bring your own caller ID and SIP trunk",
    "Priority routing and dedicated support",
  ];
  return (
    <section id="business" className="border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Briefcase className="h-3 w-3" /> For Business
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
            One dialer. Your entire global team.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Replace 5 SIP apps and a stack of physical SIMs with one browser tab. Spin up agents in minutes - no provisioning calls, no IT tickets.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-primary">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <Link to="/auth/signup"><Button>Start free trial</Button></Link>
            <a href="mailto:sales@ringlink.app"><Button variant="outline">Talk to sales</Button></a>
          </div>
        </div>
        <div className="relative">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="text-sm font-semibold">Team activity</div>
              <div className="text-xs text-muted-foreground">Today</div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { name: "Priya S.", num: "+44 20 ••• 4421", dur: "12:08", cost: "$0.42" },
                { name: "Marcus B.", num: "+1 415 ••• 7732", dur: "04:51", cost: "$0.09" },
                { name: "Lina K.", num: "+49 30 ••• 9981", dur: "27:14", cost: "$0.81" },
                { name: "Omar R.", num: "+971 4 ••• 5520", dur: "08:39", cost: "$0.66" },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.num}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{r.dur}</div>
                    <div className="text-xs text-primary">{r.cost}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyChooseUs() {
  const items = [
    { icon: Zap, title: "Sub-second connect", body: "WebRTC over our edge POPs - calls bridge faster than legacy SIP softphones." },
    { icon: Globe, title: "200+ countries", body: "Tier-1 carriers worldwide. Rates from $0.01/min, fully transparent." },
    { icon: ShieldCheck, title: "Private by design", body: "End-to-end TLS + SRTP encryption. We don't record or sell your audio." },
    { icon: CreditCard, title: "Pay as you go", body: "Top up any amount. No subscriptions, no minimums, credits never expire." },
    { icon: Headphones, title: "HD voice", body: "Opus codec at 48 kHz. Sounds clearer than a regular cell call." },
    { icon: Briefcase, title: "Team-ready", body: "Per-seat history, shared billing, and admin controls baked in." },
  ];
  return (
    <section id="why" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Why choose Ringlink</h2>
          <p className="mt-3 text-muted-foreground">Built by ex-telecom engineers who got tired of bloated softphones.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.title} className="rounded-2xl border border-border/60 bg-card p-6 transition hover:border-primary/40">
              <i.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{i.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{i.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    { q: "Do I need to install anything?", a: "No. Ringlink runs entirely in your browser using WebRTC. Chrome, Edge, Safari and Firefox are all supported." },
    { q: "How are calls priced?", a: "Pay-as-you-go per minute, billed by the second. Rates start at $0.01/min and are visible before you dial." },
    { q: "Can I use my own caller ID?", a: "Yes - business accounts can bring their own number or SIP trunk. Personal accounts use a shared verified caller ID." },
    { q: "Is my call audio encrypted?", a: "Always. Signalling is TLS 1.3 and media is SRTP. We never write call audio to disk." },
    { q: "Do credits expire?", a: "Never. Your balance stays available until you use it." },
    { q: "Can I get a refund?", a: "Unused credits are refundable within 30 days of purchase. Just email support." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-border/60">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
          {qs.map((item, i) => {
            const isOpen = open === i;
            return (
              <button
                key={item.q}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full px-6 py-5 text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
                </div>
                {isOpen && <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

