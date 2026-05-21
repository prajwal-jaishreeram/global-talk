import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Delete, Info, Loader2, MicOff, Mic, ChevronsUpDown, Check, Volume2 } from "lucide-react";
import { AsYouType, parsePhoneNumberFromString, getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getRateForNumber, formatCurrency } from "@/lib/rates";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getWebrtcCredentials, startCallRecord, finalizeCallRecord } from "@/lib/calls.functions";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Dialer - Ringlink" }] }),
  component: DialerPage,
});

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryName(code: string) {
  return displayNames?.of(code) ?? code;
}

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

type CallState = "idle" | "connecting" | "ringing" | "active" | "ending";

function DialerPage() {
  const [country, setCountry] = useState("US");
  const [raw, setRaw] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [telnyxState, setTelnyxState] = useState<string>("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [speakerId, setSpeakerId] = useState<string>("default");
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ringCtxRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const fetchCreds = useServerFn(getWebrtcCredentials);
  const startRecord = useServerFn(startCallRecord);
  const finalizeRecord = useServerFn(finalizeCallRecord);

  // Prefill from ?to= search param (e.g. coming from landing page hero dialer)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (!to) return;
    const digits = to.replace(/\D/g, "");
    for (let len = 3; len >= 1; len--) {
      const prefix = digits.slice(0, len);
      const code = getCountries().find((c) => getCountryCallingCode(c) === prefix);
      if (code) {
        setCountry(code);
        setRaw(digits.slice(len));
        return;
      }
    }
    setRaw(digits);
  }, []);

  const countries = useMemo(() => {
    return getCountries()
      .map((c) => ({
        code: c,
        name: countryName(c),
        dial: getCountryCallingCode(c),
        flag: flagEmoji(c),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const [countryOpen, setCountryOpen] = useState(false);

  function handlePhoneChange(value: string) {
    // Allow manual + prefix to switch country
    if (value.startsWith("+")) {
      const digits = value.replace(/\D/g, "");
      // try longest match first
      for (let len = 3; len >= 1; len--) {
        const prefix = digits.slice(0, len);
        const match = countries.find((c) => c.dial === prefix);
        if (match) {
          setCountry(match.code);
          setRaw(digits.slice(len));
          return;
        }
      }
    }
    setRaw(value.replace(/\D/g, ""));
  }


  const callingCode = getCountryCallingCode(country as never);
  const e164 = `+${callingCode}${raw.replace(/\D/g, "")}`;
  const parsed = parsePhoneNumberFromString(e164);
  const formatted = parsed ? new AsYouType(country as never).input(raw) : raw;
  const isValid = parsed?.isValid() ?? false;
  const { rate, country: detected } = getRateForNumber(e164);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      try { callRef.current?.hangup?.(); } catch {}
      try { clientRef.current?.disconnect?.(); } catch {}
      stopRingback();
    };
  }, []);

  async function loadSpeakers() {
    try {
      // Request mic permission first so device labels populate
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
      const devs = await navigator.mediaDevices.enumerateDevices();
      setSpeakers(devs.filter(d => d.kind === "audiooutput"));
    } catch (e) {
      console.warn("enumerateDevices failed", e);
    }
  }

  async function applySpeaker(id: string) {
    setSpeakerId(id);
    const el = audioElRef.current as any;
    if (el?.setSinkId) {
      try { await el.setSinkId(id); } catch (e) { console.warn("setSinkId failed", e); }
    }
  }

  function startRingback() {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      gain.connect(ctx.destination);
      let osc: OscillatorNode | null = null;
      const cycle = () => {
        osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 440;
        const o2 = ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = 480;
        osc.connect(gain);
        o2.connect(gain);
        osc.start();
        o2.start();
        setTimeout(() => { try { osc?.stop(); o2.stop(); } catch {} }, 2000);
      };
      cycle();
      const iv = window.setInterval(cycle, 4000);
      ringCtxRef.current = {
        ctx,
        stop: () => { window.clearInterval(iv); try { ctx.close(); } catch {} },
      };
    } catch (e) { console.warn("ringback failed", e); }
  }
  function stopRingback() {
    ringCtxRef.current?.stop();
    ringCtxRef.current = null;
  }

  function startTimer() {
    startedAtRef.current = Date.now();
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      if (startedAtRef.current) {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000) as unknown as number;
  }

  async function cleanup(status: "completed" | "failed" | "no_answer") {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopRingback();
    const dur = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : 0;
    const id = callIdRef.current;
    try { clientRef.current?.disconnect?.(); } catch {}
    callRef.current = null;
    clientRef.current = null;
    if (id) {
      try {
        const res = await finalizeRecord({
          data: { call_id: id, duration_seconds: dur, status },
        });
        if (res?.cost > 0) toast.success(`Call ended · ${formatCurrency(res.cost)} charged`);
      } catch (e: any) {
        console.error(e);
      }
    }
    callIdRef.current = null;
    startedAtRef.current = null;
    setCallState("idle");
    setTelnyxState("");
    setSeconds(0);
    setMuted(false);
  }

  function press(ch: string) {
    if (callState === "active" && callRef.current?.dtmf) {
      try { callRef.current.dtmf(ch); } catch {}
      return;
    }
    setRaw((r) => r + ch);
  }
  function backspace() {
    setRaw((r) => r.slice(0, -1));
  }

  async function startCall() {
    if (!isValid) return toast.error("Enter a valid number");
    setCallState("connecting");
    setTelnyxState("connecting socket");
    startRingback();
    try {
      // populate speaker list (after gesture)
      loadSpeakers();
      const [{ username, password }, { id }, mod] = await Promise.all([
        fetchCreds(),
        startRecord({
          data: { to_number: e164, country_code: detected, rate_per_minute: rate },
        }),
        import("@telnyx/webrtc"),
      ]);
      callIdRef.current = id;
      const client = new mod.TelnyxRTC({ login: username, password });
      clientRef.current = client;

      client.on("telnyx.ready", () => {
        setTelnyxState("socket ready, dialing");
        const call = client.newCall({
          destinationNumber: e164,
          audio: true,
          remoteElement: "telnyx-remote-audio",
        });
        callRef.current = call;
        setCallState("ringing");
      });
      client.on("telnyx.error", (err: any) => {
        console.error("telnyx.error", err);
        toast.error("Connection error", { description: err?.error?.message ?? String(err) });
        cleanup("failed");
      });
      client.on("telnyx.socket.error", (err: any) => {
        console.error("socket error", err);
        toast.error("Network error");
        cleanup("failed");
      });
      client.on("telnyx.notification", (n: any) => {
        console.log("telnyx.notification", n);
        if (n.type !== "callUpdate" || !n.call) return;
        const s = n.call.state;
        setTelnyxState(s);
        if (s === "active") {
          stopRingback();
          setCallState("active");
          if (!startedAtRef.current) startTimer();
        } else if (s === "hangup" || s === "destroy") {
          cleanup(startedAtRef.current ? "completed" : "no_answer");
        } else if (s === "ringing" || s === "trying" || s === "requesting") {
          setCallState("ringing");
        }
      });
      client.connect();
    } catch (e: any) {
      console.error(e);
      toast.error("Could not start call", { description: e?.message ?? String(e) });
      cleanup("failed");
    }
  }

  function hangup() {
    setCallState("ending");
    try { callRef.current?.hangup?.(); } catch {}
    // cleanup will fire on hangup notification; fallback in case it doesn't
    setTimeout(() => {
      if (callRef.current || clientRef.current) {
        cleanup(startedAtRef.current ? "completed" : "failed");
      }
    }, 2000);
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    try {
      if (muted) call.unmuteAudio?.();
      else call.muteAudio?.();
      setMuted((m) => !m);
    } catch {}
  }

  const keys = ["1","2","3","4","5","6","7","8","9","*","0","#"];
  const keyMeta: Record<string, string | undefined> = {
    "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL",
    "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ", "0": "+",
  };
  const [alpha, setAlpha] = useState(false);
  const inCall = callState !== "idle";
  const fmtTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const liveCost = (seconds / 60) * rate;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col items-center justify-center px-4 py-4 md:min-h-[calc(100vh-1px)]">
      <audio
        id="telnyx-remote-audio"
        autoPlay
        playsInline
        ref={(el) => { audioElRef.current = el; }}
      />
      <div className="w-full rounded-[2rem] border-2 border-border bg-card/80 p-6 shadow-xl shadow-black/20 backdrop-blur dark:shadow-black/40">
        {/* Top row: country + number + backspace */}
        <div className="flex items-center gap-2">
          <Popover open={countryOpen} onOpenChange={setCountryOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={inCall}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <span className="text-base leading-none">{flagEmoji(country)}</span>
                <span className="font-mono text-xs">+{callingCode}</span>
                <ChevronsUpDown className="h-3 w-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
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
                        onSelect={() => {
                          setCountry(c.code);
                          setCountryOpen(false);
                        }}
                      >
                        <span className="mr-2 text-base leading-none">{c.flag}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">+{c.dial}</span>
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            country === c.code ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Input
            value={formatted}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="Phone number"
            inputMode="tel"
            disabled={inCall}
            className="h-8 flex-1 border-0 border-b border-border bg-transparent px-0 font-mono text-base tracking-wide shadow-none focus-visible:ring-0 focus-visible:border-primary"
          />
          <button
            onClick={backspace}
            disabled={inCall || !raw}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Backspace"
          >
            <Delete className="h-4 w-4" />
          </button>
        </div>

        {/* Status / rate line */}
        <div className="mt-2 flex h-5 items-center justify-between text-[11px] text-muted-foreground">
          {inCall ? (
            <>
              <span className="uppercase tracking-wider">
                {callState === "connecting" && "Connecting…"}
                {callState === "ringing" && "Ringing…"}
                {callState === "active" && "In call"}
                {callState === "ending" && "Ending…"}
              </span>
              <span className="font-mono tabular-nums">
                {fmtTime}{callState === "active" && ` · ${formatCurrency(liveCost)}`}
              </span>
            </>
          ) : (
            <>
              <span>{detected ? countryName(detected) : "Unknown destination"}</span>
              <span className="inline-flex items-center gap-1">
                <Info className="h-3 w-3" /> {formatCurrency(rate)}/min
              </span>
            </>
          )}
        </div>

        {/* Keypad */}
        <div className="mt-4 grid grid-cols-3 place-items-center gap-y-3">
          {keys.map((k) => {
            const sub = keyMeta[k];
            return (
              <button
                key={k}
                onClick={() => press(alpha && sub ? sub[0] : k)}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-muted/70 transition hover:bg-muted active:scale-95"
              >
                <span className="text-2xl font-semibold leading-none">
                  {alpha && sub ? sub : k}
                </span>
                {sub && (
                  <span className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground">
                    {alpha ? k : sub}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom action row */}
        <div className="mt-4 grid grid-cols-3 place-items-center">
          {inCall ? (
            <button
              onClick={toggleMute}
              disabled={callState !== "active"}
              className="grid h-12 w-12 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted disabled:opacity-40"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : (
            <button
              onClick={() => setAlpha((a) => !a)}
              className="grid h-12 w-12 place-items-center rounded-full bg-muted/70 text-xs font-semibold text-muted-foreground hover:bg-muted"
              aria-label="Toggle letters"
            >
              {alpha ? "123" : "ABC"}
            </button>
          )}
          {inCall ? (
            <button
              onClick={hangup}
              aria-label="End call"
              className="grid h-16 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition hover:opacity-90 active:scale-95"
            >
              {callState === "connecting" || callState === "ending" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <PhoneOff className="h-7 w-7" />
              )}
            </button>
          ) : (
            <button
              onClick={startCall}
              disabled={!isValid}
              aria-label="Call"
              className="grid h-16 w-16 place-items-center rounded-full bg-call text-call-foreground shadow-lg shadow-call/30 transition hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              <Phone className="h-7 w-7" />
            </button>
          )}
          {inCall ? (
            <button
              onClick={() => {
                if (speakers.length === 0) { loadSpeakers(); return; }
                const ids = speakers.map((s) => s.deviceId);
                const idx = ids.indexOf(speakerId);
                const next = ids[(idx + 1) % ids.length] ?? "default";
                applySpeaker(next);
              }}
              aria-label="Speaker"
              title="Switch audio output"
              className="grid h-12 w-12 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted"
            >
              <Volume2 className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={backspace}
              disabled={!raw}
              aria-label="Backspace"
              className="grid h-12 w-12 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <Delete className="h-5 w-5" />
            </button>
          )}
        </div>

        {telnyxState && inCall && (
          <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
            telnyx: {telnyxState}
          </div>
        )}
      </div>
    </div>
  );
}