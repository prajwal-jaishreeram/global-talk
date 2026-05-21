import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Delete, Info, Loader2, MicOff, Mic, ChevronsUpDown, Check } from "lucide-react";
import { AsYouType, parsePhoneNumberFromString, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
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
  head: () => ({ meta: [{ title: "Dialer — Ringlink" }] }),
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
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const fetchCreds = useServerFn(getWebrtcCredentials);
  const startRecord = useServerFn(startCallRecord);
  const finalizeRecord = useServerFn(finalizeCallRecord);

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
    };
  }, []);

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
    try {
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
        const call = client.newCall({
          destinationNumber: e164,
          callerNumber: "+10000000000",
          audio: true,
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
        if (n.type !== "callUpdate" || !n.call) return;
        const s = n.call.state;
        if (s === "active") {
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
  const inCall = callState !== "idle";
  const fmtTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const liveCost = (seconds / 60) * rate;

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Make a call</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dial any international number. Credits deduct per second.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex gap-2">
          <Select value={country} onValueChange={setCountry} disabled={inCall}>
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
            disabled={inCall}
            className="text-lg font-medium tracking-wider"
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{detected ? `${COUNTRY_NAMES[detected] ?? detected}` : "Unknown destination"}</span>
          <span className="inline-flex items-center gap-1">
            <Info className="h-3 w-3" /> {formatCurrency(rate)}/min
          </span>
        </div>

        {inCall && (
          <div className="mt-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {callState === "connecting" && "Connecting…"}
              {callState === "ringing" && "Ringing…"}
              {callState === "active" && "In call"}
              {callState === "ending" && "Ending…"}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtTime}</div>
            {callState === "active" && (
              <div className="text-xs text-muted-foreground">{formatCurrency(liveCost)} so far</div>
            )}
          </div>
        )}

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
          {inCall ? (
            <>
              <button
                onClick={toggleMute}
                disabled={callState !== "active"}
                className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-40"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <Button
                size="lg"
                onClick={hangup}
                variant="destructive"
                className="h-16 w-16 rounded-full p-0 shadow-lg"
              >
                {callState === "connecting" || callState === "ending" ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <PhoneOff className="h-6 w-6" />
                )}
              </Button>
              <div className="w-12" />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}