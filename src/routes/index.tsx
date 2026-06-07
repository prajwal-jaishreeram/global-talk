import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Globe,
  Zap,
  ShieldCheck,
  Delete,
  Briefcase,
  Headphones,
  CreditCard,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ChevronDown,
  Sparkles,
  Plus,
  Volume2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuthState } from "@/lib/auth-client";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ringringa - Browser-based international calling" },
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
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash]);
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

function AuthAwareCTA() {
  const { ready, isAuthenticated } = useAuthState();
  if (!ready)
    return (
      <Button size="lg" disabled className="w-full text-base sm:w-auto">
        Loading...
      </Button>
    );
  if (isAuthenticated) {
    return (
      <Link to="/dashboard" className="w-full sm:w-auto">
        <Button
          size="lg"
          className="w-full gap-1.5 text-base shadow-lg shadow-primary/15 sm:w-auto"
        >
          <PhoneCall className="h-4 w-4" /> Make a call
        </Button>
      </Link>
    );
  }
  return (
    <Link to="/auth/signup" className="w-full sm:w-auto">
      <Button size="lg" className="w-full gap-2 text-base shadow-lg shadow-primary/15 sm:w-auto">
        <PhoneCall className="h-4 w-4" />
        Start with $5 free credit
      </Button>
    </Link>
  );
}

const flagAssets = import.meta.glob("../assets/flags/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const HERO_FLAGS = Object.entries(flagAssets)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src], index) => ({
    src,
    label: path.split("/").pop()?.replace(/\.svg$/, "") ?? `flag-${index}`,
    rotate: ["rotate-3", "-rotate-3", "rotate-2", "-rotate-2", "rotate-1", "-rotate-1"][
      index % 6
    ],
  }));

function HeroFlagTrack({
  flags,
  direction,
  className,
}: {
  flags: typeof HERO_FLAGS;
  direction: "left" | "right" | "left-slow";
  className: string;
}) {
  return (
    <div
      className={`hero-flag-track hero-flag-track-${direction} absolute flex w-max items-center ${className}`}
    >
      {[0, 1].map((copy) => (
        <div
          key={copy}
          className="flex shrink-0 items-center gap-8 pr-8 sm:gap-12 sm:pr-12 lg:gap-14 lg:pr-14"
        >
          {flags.map((flag, index) => (
            <img
              key={`${flag.label}-${copy}-${index}`}
              src={flag.src}
              alt=""
              className={`hero-flag-card h-16 w-24 shrink-0 ${flag.rotate} sm:h-20 sm:w-32 lg:h-24 lg:w-36`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function HeroFlagBackground() {
  const rows = [
    HERO_FLAGS,
    [...HERO_FLAGS.slice(Math.ceil(HERO_FLAGS.length / 3)), ...HERO_FLAGS.slice(0, Math.ceil(HERO_FLAGS.length / 3))],
    [...HERO_FLAGS.slice(Math.ceil((HERO_FLAGS.length * 2) / 3)), ...HERO_FLAGS.slice(0, Math.ceil((HERO_FLAGS.length * 2) / 3))],
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(59,130,246,0.16),transparent_36%),linear-gradient(90deg,rgba(0,0,0,0.68),transparent_45%,rgba(0,0,0,0.5))]" />
      <HeroFlagTrack
        flags={rows[0]}
        direction="left"
        className="right-[-38%] top-[-3%] z-[1] origin-center -rotate-[28deg] opacity-[0.58] blur-[0.1px] sm:right-[-28%] sm:top-[-5%] sm:opacity-[0.52]"
      />
      <HeroFlagTrack
        flags={rows[1]}
        direction="right"
        className="right-[-48%] top-[31%] z-[1] origin-center -rotate-[28deg] opacity-[0.5] blur-[0.1px] sm:right-[-36%] sm:top-[28%] sm:opacity-[0.45]"
      />
      <HeroFlagTrack
        flags={rows[2]}
        direction="left-slow"
        className="right-[-42%] top-[65%] z-[1] origin-center -rotate-[28deg] opacity-[0.54] blur-[0.1px] sm:right-[-31%] sm:top-[63%] sm:opacity-[0.48]"
      />
      <div className="absolute inset-0 z-[2] bg-background/24 dark:bg-background/[0.03]" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-background/88 via-background/18 to-background/42" />
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
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const countries = useState(() =>
    getCountries()
      .map((c) => {
        const dial = getCountryCallingCode(c);
        const name =
          (typeof Intl !== "undefined" && "DisplayNames" in Intl
            ? new Intl.DisplayNames(["en"], { type: "region" }).of(c)
            : c) ?? c;
        return { code: c, dial, name };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  )[0];
  const callingCode = getCountryCallingCode(country as never);
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
    <section className="relative overflow-hidden border-b border-border/60 bg-background">
      <HeroFlagBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.045)_44%,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-0 pt-16 sm:px-6 sm:pb-12 sm:pt-12 md:pb-14 lg:flex lg:min-h-[calc(100vh-5rem)] lg:items-center lg:px-10 lg:py-6">
        <div className="grid min-w-0 w-full gap-9 sm:gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-center lg:gap-14">
          <div className="min-w-0 w-full max-w-[22rem] text-left sm:mx-auto sm:max-w-2xl lg:mx-0">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-call shadow-[0_0_12px_var(--call)]" />
              Browser-native calling
            </span>
            <h1 className="mt-9 max-w-3xl text-4xl font-semibold leading-[1.04] text-foreground sm:mt-5 sm:text-5xl lg:text-5xl xl:text-6xl">
              Low cost international calls from your browser.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Make clear international calls without apps, SIM swaps, or long-term carrier
              contracts. Ringringa gives teams a polished dialer, transparent rates, and prepaid
              control in one secure workspace.
            </p>
            <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:mt-6 sm:flex-row lg:justify-start">
              <AuthAwareCTA />
              <a href="#how" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/10 bg-white/[0.03] text-base hover:bg-white/[0.07] sm:w-auto"
                >
                  <Sparkles className="h-4 w-4" />
                  See how it works
                </Button>
              </a>
            </div>

            <div className="mt-9 grid max-w-sm grid-cols-2 gap-x-5 gap-y-3 text-left sm:mt-6 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:gap-x-6">
              {[
                { label: "Coverage", value: "200+ countries", icon: Globe },
                { label: "Security", value: "TLS + SRTP", icon: ShieldCheck },
                { label: "Connection", value: "Sub-second connect", icon: Zap },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 shrink-0 text-primary" />
                  <div className="text-sm">
                    <span className="hidden text-muted-foreground sm:inline">{item.label}: </span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto min-w-0 w-full max-w-full sm:max-w-[560px]">
            <div className="relative z-10 mx-auto w-full max-w-[340px] rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-2 shadow-2xl shadow-black/40">
              <div className="rounded-[1.65rem] border border-white/10 bg-background/95 p-3.5">
                <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15" />

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
                  <div className="flex items-center justify-between">
                    <Link
                      to="/dashboard/credits"
                      className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
                    >
                      Balance $5.00
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Plus className="h-3 w-3" />
                      </span>
                    </Link>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-call/10 px-2.5 py-1 text-[11px] text-call">
                      <span className="h-1.5 w-1.5 rounded-full bg-call" />
                      Ready
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <CountryFlag code={country} />
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
                          <CommandInput placeholder="Search country or +code..." />
                          <CommandList>
                            <CommandEmpty>No country found.</CommandEmpty>
                            <CommandGroup>
                              {countries.map((c) => (
                                <CommandItem
                                  key={c.code}
                                  value={`${c.name} ${c.code} +${c.dial}`}
                                  onSelect={() => {
                                    setCountry(c.code);
                                    setCountryOpen(false);
                                  }}
                                >
                                  <CountryFlag code={c.code} className="mr-2" />
                                  <span className="w-6 text-xs font-semibold text-foreground">
                                    {c.code}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    +{c.dial}
                                  </span>
                                  <span className="ml-3 flex-1 truncate">{c.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="min-w-0 flex-1 border-b border-white/10 pb-1.5 text-left font-mono text-lg text-foreground">
                      {number || (
                        <span className="font-sans text-sm text-muted-foreground">
                          Enter number
                        </span>
                      )}
                    </div>
                    <button
                      onClick={back}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                      aria-label="Backspace"
                    >
                      <Delete className="h-4 w-4" />
                    </button>
                  </div>

                  {inCall ? (
                    <div className="mt-3 flex h-7 items-center justify-between rounded-full bg-white/[0.035] px-3 text-xs text-muted-foreground">
                      <span>Connecting...</span>
                      <span>Encrypted route</span>
                    </div>
                  ) : (
                    <Link
                      to="/dashboard/contacts"
                      className="mt-3 flex h-7 items-center justify-center gap-1.5 rounded-full bg-white/[0.035] px-3 text-xs text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Add contact</span>
                    </Link>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 place-items-center gap-y-2.5">
                  {keys.map((k) => (
                    <button
                      key={k.d}
                      onClick={() => press(k.d, k.sub)}
                      className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-white/10 bg-white/[0.045] transition hover:bg-white/[0.08] active:scale-95"
                    >
                      <span className="text-lg font-semibold leading-none">
                        {alpha && k.sub ? k.sub : k.d}
                      </span>
                      {!alpha && k.sub && (
                        <span className="mt-0.5 text-[9px] text-muted-foreground">{k.sub}</span>
                      )}
                      {alpha && k.sub && (
                        <span className="mt-0.5 text-[9px] text-muted-foreground">{k.d}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 place-items-center">
                  {inCall ? (
                    <button
                      onClick={() => setMuted((m) => !m)}
                      aria-label={muted ? "Unmute" : "Mute"}
                      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-muted-foreground hover:bg-white/[0.08]"
                    >
                      {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => setAlpha((a) => !a)}
                      aria-label="Toggle letters"
                      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-xs font-semibold text-muted-foreground hover:bg-white/[0.08]"
                    >
                      {alpha ? "123" : "ABC"}
                    </button>
                  )}
                  {inCall ? (
                    <button
                      onClick={endCall}
                      aria-label="End call"
                      className="grid h-14 w-14 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 transition hover:opacity-90 active:scale-95"
                    >
                      <PhoneOff className="h-6 w-6" />
                    </button>
                  ) : (
                    <button
                      onClick={startCall}
                      disabled={!number}
                      aria-label="Call"
                      className="grid h-14 w-14 place-items-center rounded-full bg-call text-call-foreground shadow-lg shadow-call/25 transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                    >
                      <PhoneCall className="h-6 w-6" />
                    </button>
                  )}
                  {inCall ? (
                    <button
                      aria-label="Speaker"
                      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-muted-foreground hover:bg-white/[0.08]"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={back}
                      aria-label="Backspace"
                      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-muted-foreground hover:bg-white/[0.08]"
                    >
                      <Delete className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
              Interactive preview. Sign up to place real calls.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowToCall() {
  const steps = [
    {
      icon: CreditCard,
      title: "Create your account",
      body: "Sign up in 30 seconds and grab $5 in trial credit. No card required.",
    },
    {
      icon: Mic,
      title: "Allow microphone",
      body: "Your browser asks once. We never record - audio streams peer-to-peer over SRTP.",
    },
    {
      icon: PhoneCall,
      title: "Dial & connect",
      body: "Type any international number, hit call. The phone rings in under a second.",
    },
  ];
  return (
    <section id="how" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How to make a call</h2>
          <p className="mt-3 text-muted-foreground">
            Three steps. No installs, no plugins, no learning curve.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
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
            Replace 5 SIP apps and a stack of physical SIMs with one browser tab. Spin up agents in
            minutes - no provisioning calls, no IT tickets.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-primary">
                  ✓
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <Link to="/auth/signup">
              <Button>Start free trial</Button>
            </Link>
            <a href="mailto:prajwalshindeee@gmail.com">
              <Button variant="outline">Talk to sales</Button>
            </a>
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
                <div
                  key={r.name}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                >
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
    {
      icon: Zap,
      title: "Sub-second connect",
      body: "WebRTC over our edge POPs - calls bridge faster than legacy SIP softphones.",
    },
    {
      icon: Globe,
      title: "200+ countries",
      body: "Tier-1 carriers worldwide. Rates from $0.01/min, fully transparent.",
    },
    {
      icon: ShieldCheck,
      title: "Private by design",
      body: "End-to-end TLS + SRTP encryption. We don't record or sell your audio.",
    },
    {
      icon: CreditCard,
      title: "Pay as you go",
      body: "Top up any amount. No subscriptions, no minimums, credits never expire.",
    },
    {
      icon: Headphones,
      title: "HD voice",
      body: "Opus codec at 48 kHz. Sounds clearer than a regular cell call.",
    },
    {
      icon: Briefcase,
      title: "Team-ready",
      body: "Per-seat history, shared billing, and admin controls baked in.",
    },
  ];
  return (
    <section id="why" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Why choose Ringringa</h2>
          <p className="mt-3 text-muted-foreground">
            Built by ex-telecom engineers who got tired of bloated softphones.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div
              key={i.title}
              className="rounded-2xl border border-border/60 bg-card p-6 transition hover:border-primary/40"
            >
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
    {
      q: "Do I need to install anything?",
      a: "No. Ringringa runs entirely in your browser using WebRTC. Chrome, Edge, Safari and Firefox are all supported.",
    },
    {
      q: "How are calls priced?",
      a: "Pay-as-you-go per minute, billed by the second. Rates start at $0.01/min and are visible before you dial.",
    },
    {
      q: "Can I use my own caller ID?",
      a: "Yes - business accounts can bring their own number or SIP trunk. Personal accounts use a shared verified caller ID.",
    },
    {
      q: "Is my call audio encrypted?",
      a: "Always. Signalling is TLS 1.3 and media is SRTP. We never write call audio to disk.",
    },
    { q: "Do credits expire?", a: "Never. Your balance stays available until you use it." },
    {
      q: "Can I get a refund?",
      a: "Unused credits are refundable within 14 days of purchase. Failed calls can be reviewed for make-up credits or a refund.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-border/60">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Frequently asked questions
        </h2>
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
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`}
                  />
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
