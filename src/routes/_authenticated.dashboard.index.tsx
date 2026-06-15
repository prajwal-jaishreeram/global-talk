import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Delete,
  Info,
  Loader2,
  MicOff,
  Mic,
  ChevronsUpDown,
  Check,
  Volume2,
  FileText,
  UserPlus,
  Globe,
  Megaphone,
  Smartphone,
  ChevronDown,
  Search,
  ShoppingCart,
} from "lucide-react";
import {
  AsYouType,
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import metadata from "libphonenumber-js/metadata.min.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getRateForNumber } from "@/lib/rates";
import { toast } from "sonner";
import { getWebrtcCredentials, startCallRecord, finalizeCallRecord } from "@/lib/calls";
import { CallNotesPanel } from "@/components/call-notes-panel";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";
import { useServerFn } from "@tanstack/react-start";
import {
  searchAvailableNumbers,
  initiateCallerIdVerification,
  confirmCallerIdVerification,
  listVerifiedCallerIds,
  removeVerifiedCallerId,
} from "@/lib/telnyx.functions";
import {
  createNumberOrder,
  verifyAndProvisionNumber,
  cancelPendingNumberOrder,
} from "@/lib/razorpay.functions";
import { CountryFlag } from "@/components/country-flag";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Make a call - Ringringa" }] }),
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
  return String.fromCodePoint(...code.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function nationalNumberLengths(code: CountryCode) {
  const plan = metadata.countries[code] as unknown[] | undefined;
  const lengths = Array.isArray(plan?.[3])
    ? (plan[3] as unknown[]).filter((n): n is number => typeof n === "number")
    : [];
  return lengths.length > 0 ? lengths : [15];
}

function maxNationalDigits(code: CountryCode) {
  return Math.max(...nationalNumberLengths(code));
}

function sanitizeNationalDigits(value: string, code: CountryCode) {
  return value.replace(/\D/g, "").slice(0, maxNationalDigits(code));
}

function sanitizeDialInput(value: string, code: CountryCode) {
  const maxDigitsForCountry = maxNationalDigits(code);
  let digitCount = 0;
  let next = "";
  for (const char of value) {
    if (/\d/.test(char)) {
      if (digitCount >= maxDigitsForCountry) continue;
      digitCount += 1;
      next += char;
    } else if (char === "*" || char === "#") {
      next += char;
    }
  }
  return next;
}

function countryForDialPrefix(prefix: string, candidates?: Array<{ code: CountryCode; dial: string }>) {
  if (prefix === "1") return "US" as CountryCode;
  const match =
    candidates?.find((c) => c.dial === prefix)?.code ??
    getCountries().find((c) => getCountryCallingCode(c) === prefix);
  return match ?? null;
}

type CallState = "idle" | "connecting" | "ringing" | "active" | "ending";

type VerifiedCallerId = { phone_number: string; status: string };

type WindowWithLegacyAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type WebrtcCallLike = {
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  state?: unknown;
  peer?: { instance?: RTCPeerConnection | null };
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  updateMedia?: (options: { iceRestart?: boolean }) => void;
};

const TELNYX_STATE_NAMES: Record<number, string> = {
  0: "new",
  1: "requesting",
  2: "trying",
  3: "recovering",
  4: "ringing",
  5: "answering",
  6: "early",
  7: "active",
  8: "held",
  9: "hangup",
  10: "destroy",
  11: "purge",
};

const TERMINAL_TELNYX_STATES = new Set([
  "hangup",
  "destroy",
  "purge",
  "bye",
  "closed",
  "ended",
  "terminated",
]);

const SPEAKER_BOOST_GAIN = 1.8;

function normalizeTelnyxCallState(value: unknown) {
  if (typeof value === "number") return TELNYX_STATE_NAMES[value] ?? String(value);
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function isTerminalTelnyxCallState(value: unknown) {
  return TERMINAL_TELNYX_STATES.has(normalizeTelnyxCallState(value));
}

function isVerifiedCallerId(phone: string, numbers: VerifiedCallerId[]) {
  return numbers.some(
    (n) => n.phone_number === phone && n.status.toLowerCase() === "verified",
  );
}

function looksLikeProviderPolicyBlock(input: {
  cause?: string;
  causeCode?: string | number;
  sipCode?: string | number;
  sipReason?: string;
}) {
  const code = Number(input.sipCode);
  const carrierCode = Number(input.causeCode);
  const detail = [
    input.cause,
    input.causeCode,
    input.sipCode,
    input.sipReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    code === 402 ||
    code === 403 ||
    carrierCode === 402 ||
    carrierCode === 403 ||
    detail.includes("trial") ||
    detail.includes("verified") ||
    detail.includes("forbidden") ||
    detail.includes("not allowed") ||
    detail.includes("unauthorized") ||
    detail.includes("unverified")
  );
}

const BUY_NUMBER_COUNTRIES = [
  { code: "US", dial: "+1" },
  { code: "CA", dial: "+1" },
  { code: "GB", dial: "+44" },
  { code: "GR", dial: "+30" },
  { code: "AU", dial: "+61" },
  { code: "DE", dial: "+49" },
  { code: "FR", dial: "+33" },
  { code: "NL", dial: "+31" },
  { code: "IN", dial: "+91" },
];

// Lazy-load the Razorpay Checkout JS so the page only fetches it when the
// user actually starts a purchase. Returns a cached promise on repeat calls.
let razorpayScriptPromiseInline: Promise<void> | null = null;
function loadRazorpayScriptInline(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayScriptPromiseInline) return razorpayScriptPromiseInline;
  razorpayScriptPromiseInline = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      razorpayScriptPromiseInline = null;
      reject(new Error("Failed to load Razorpay script"));
    };
    document.head.appendChild(s);
  });
  return razorpayScriptPromiseInline;
}

/**
 * Standalone timer display. Subscribes to a parent-provided register fn so
 * tick updates re-render only this small node, not the giant DialerPage tree.
 */
function CallTimer({ register }: { register: (fn: (s: number) => void) => () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => register(setSeconds), [register]);
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <span className="font-mono tabular-nums">{fmt}</span>;
}

function DialerPage() {
  const { user } = useAuthState();
  const [country, setCountry] = useState<CountryCode>("US");
  const [raw, setRaw] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [telnyxState, setTelnyxState] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const secondsRef = useRef(0);
  const timerListenersRef = useRef<Set<(s: number) => void>>(new Set());
  const setSeconds = (s: number) => {
    secondsRef.current = s;
    timerListenersRef.current.forEach((fn) => fn(s));
  };
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [speakerId, setSpeakerId] = useState<string>("default");
  const [speakerOn, setSpeakerOn] = useState(false);
  const speakerIdRef = useRef("default");
  const speakerOnRef = useRef(false);
  const lastDefaultVolumeRef = useRef<number>(1);
  const [callFrom, setCallFrom] = useState<{ kind: "public" | "custom"; number?: string }>({
    kind: "public",
  });
  const [callFromOpen, setCallFromOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNumber, setVerifyNumber] = useState("");
  const [verifySaving, setVerifySaving] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"enter" | "code">("enter");
  const [verifyMethod, setVerifyMethod] = useState<"sms" | "call">("sms");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifiedNumbers, setVerifiedNumbers] = useState<VerifiedCallerId[]>([]);
  const initiateCallerIdFn = useServerFn(initiateCallerIdVerification);
  const confirmCallerIdFn = useServerFn(confirmCallerIdVerification);
  const listVerifiedFn = useServerFn(listVerifiedCallerIds);
  const removeVerifiedFn = useServerFn(removeVerifiedCallerId);
  const [buyOpen, setBuyOpen] = useState(false);
  const [alpha, setAlpha] = useState(false);
  const [alphaInput, setAlphaInput] = useState("");
  const multitapRef = useRef<{ k: string; idx: number; time: number } | null>(null);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [mobileContactSearchOpen, setMobileContactSearchOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<
    { id: string; name: string; phone: string; company: string | null }[]
  >([]);
  const [buyCountry, setBuyCountry] = useState("US");
  const [buyAreaCode, setBuyAreaCode] = useState("");
  const [buySearching, setBuySearching] = useState(false);
  const [buyResults, setBuyResults] = useState<
    { phone_number: string; monthly_cost: number; currency: string; region: string | null }[]
  >([]);
  const [buying, setBuying] = useState<string | null>(null);
  const searchNumbersFn = useServerFn(searchAvailableNumbers);
  const createNumberOrderFn = useServerFn(createNumberOrder);
  const verifyNumberOrderFn = useServerFn(verifyAndProvisionNumber);
  const cancelNumberOrderFn = useServerFn(cancelPendingNumberOrder);
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const activeAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const cleanupRunningRef = useRef(false);
  const callStartLockedRef = useRef(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ringCtxRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const remoteAudioBoostRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    source: MediaStreamAudioSourceNode | null;
    stream: MediaStream | null;
  } | null>(null);
  const heardRemoteAudioRef = useRef(false);
  const remoteTrackBindingsRef = useRef<WeakSet<object>>(new WeakSet());

  // Prefill from ?to= or ?dial= search params.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to") ?? params.get("dial");
    if (!to) return;
    const digits = to.replace(/\D/g, "");
    for (let len = 3; len >= 1; len--) {
      const prefix = digits.slice(0, len);
      const code = countryForDialPrefix(prefix);
      if (code) {
        setCountry(code);
        setRaw(sanitizeNationalDigits(digits.slice(len), code));
        return;
      }
    }
    setRaw(sanitizeNationalDigits(digits, country));
  }, []);

  const [countryOpen, setCountryOpen] = useState(false);
  const [countries, setCountries] = useState<
    Array<{ code: CountryCode; name: string; dial: string }>
  >([]);
  // Build the (heavy) country list lazily — first time the popover opens, or
  // when a "+" prefix is typed. This keeps first paint of the dialer fast.
  function ensureCountries() {
    if (countries.length > 0) return countries;
    const list = getCountries()
      .map((c) => ({
        code: c,
        name: countryName(c),
        dial: getCountryCallingCode(c),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setCountries(list);
    return list;
  }

  function handlePhoneChange(value: string) {
    // Allow manual + prefix to switch country
    if (value.startsWith("+")) {
      const digits = value.replace(/\D/g, "");
      const list = ensureCountries();
      // try longest match first
      for (let len = 3; len >= 1; len--) {
        const prefix = digits.slice(0, len);
        const match = countryForDialPrefix(prefix, list);
        if (match) {
          setCountry(match);
          setRaw(sanitizeNationalDigits(digits.slice(len), match));
          return;
        }
      }
    }
    setRaw(sanitizeDialInput(value, country));
  }

  useEffect(() => {
    if (!user || (!contactSearchOpen && !mobileContactSearchOpen) || contacts.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,phone,company")
        .order("name", { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) {
        toast.error("Could not load contacts", { description: error.message });
        return;
      }
      setContacts((data ?? []) as any);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactSearchOpen, mobileContactSearchOpen, user]);

  async function refreshVerifiedNumbers() {
    try {
      const res = await listVerifiedFn({ data: undefined as any });
      const next = (res.numbers ?? []).map((n: any) => ({
        phone_number: n.phone_number,
        status: n.status,
      }));
      setVerifiedNumbers(next);
      return next;
    } catch (e: any) {
      console.warn("listVerifiedCallerIds failed", e);
      return [] as VerifiedCallerId[];
    }
  }

  useEffect(() => {
    if (!user) return;
    refreshVerifiedNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function selectContact(phone: string) {
    handlePhoneChange(phone);
    setContactSearchOpen(false);
    setContactQuery("");
  }

  async function runNumberSearch() {
    setBuySearching(true);
    setBuyResults([]);
    try {
      const res = await searchNumbersFn({
        data: { country: buyCountry, areaCode: buyAreaCode, limit: 20 },
      });
      setBuyResults(res.numbers as any);
      if (res.numbers.length === 0) toast.message("No numbers matched your search");
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
    } finally {
      setBuySearching(false);
    }
  }

  async function buyNumber(num: { phone_number: string }) {
    setBuying(num.phone_number);
    try {
      await loadRazorpayScriptInline();
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Could not load Razorpay checkout");

      const order = await createNumberOrderFn({
        data: { phoneNumber: num.phone_number, country: buyCountry },
      });

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
              cancelNumberOrderFn({ data: { rowId: order.rowId } }).catch(() => {});
              reject(new Error("Payment cancelled"));
            },
          },
          handler: async (resp: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyNumberOrderFn({ data: resp });
              resolve();
            } catch (e: any) {
              reject(e);
            }
          },
        });
        rzp.on("payment.failed", (e: any) => {
          cancelNumberOrderFn({ data: { rowId: order.rowId } }).catch(() => {});
          reject(new Error(e?.error?.description ?? "Payment failed"));
        });
        rzp.open();
      });

      toast.success(`Purchased ${num.phone_number}`);
      setBuyResults((rs) => rs.filter((r) => r.phone_number !== num.phone_number));
      setCallFrom({ kind: "custom", number: num.phone_number });
      setBuyOpen(false);
    } catch (e: any) {
      if (e?.message && e.message !== "Payment cancelled") {
        toast.error(e.message);
      }
    } finally {
      setBuying(null);
    }
  }

  const callingCode = useMemo(() => getCountryCallingCode(country), [country]);
  const e164 = useMemo(() => `+${callingCode}${raw.replace(/\D/g, "")}`, [callingCode, raw]);
  const hasDialSymbols = /[*#]/.test(raw);
  const parsed = useMemo(() => parsePhoneNumberFromString(e164), [e164]);
  const formatted = useMemo(
    () => (parsed && !hasDialSymbols ? new AsYouType(country).input(raw) : raw),
    [parsed, country, raw, hasDialSymbols],
  );
  const isValid = !hasDialSymbols && (parsed?.isValid() ?? false);
  const { rate, country: detected } = useMemo(() => getRateForNumber(e164), [e164]);
  const maxDigits = useMemo(() => maxNationalDigits(country), [country]);
  const allowedLengths = useMemo(() => nationalNumberLengths(country), [country]);
  const digitLimitLabel =
    allowedLengths.length === 1 ? `${maxDigits} digits` : `up to ${maxDigits} digits`;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        callRef.current?.hangup?.();
      } catch {}
      try {
        clientRef.current?.disconnect?.();
      } catch {}
      stopRemoteAudioBoost();
      stopRingback();
    };
  }, []);

  async function loadSpeakers() {
    // Just enumerate — DO NOT call getUserMedia here. Pre-acquiring the mic
    // (and then stop()ing the tracks) races with Telnyx's own getUserMedia
    // call and on Chrome leaves the SDK with a dead audio track, which is
    // why nothing was reaching the other end. Labels for output devices
    // populate automatically once Telnyx grants mic permission.
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devs.filter((d) => d.kind === "audiooutput");
      setSpeakers(audioOutputs);
      return audioOutputs;
    } catch (e) {
      console.warn("enumerateDevices failed", e);
      return [] as MediaDeviceInfo[];
    }
  }

  async function applySpeaker(id: string) {
    speakerIdRef.current = id;
    setSpeakerId(id);
    const el = audioElRef.current as
      | (HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> })
      | null;
    if (el?.setSinkId) {
      try {
        await el.setSinkId(id);
      } catch (e) {
        console.warn("setSinkId failed", e);
      }
    }
    const boost = remoteAudioBoostRef.current?.ctx as
      | (AudioContext & { setSinkId?: (sinkId: string) => Promise<void> })
      | undefined;
    if (boost?.setSinkId) {
      try {
        await boost.setSinkId(id);
      } catch (e) {
        console.warn("AudioContext setSinkId failed", e);
      }
    }
    try {
      if (clientRef.current) clientRef.current.speaker = id;
    } catch (e) {
      console.warn("Telnyx speaker switch failed", e);
    }
  }

  function getRemoteAudioStream() {
    const src = audioElRef.current?.srcObject;
    return typeof MediaStream !== "undefined" && src instanceof MediaStream ? src : null;
  }

  function ensureRemoteAudioBoost(stream?: MediaStream | null) {
    if (typeof window === "undefined") return false;
    const remoteStream = stream ?? getRemoteAudioStream();
    const audioWindow = window as WindowWithLegacyAudioContext;
    const AudioContextCtor: typeof AudioContext | undefined =
      audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return false;

    let boost = remoteAudioBoostRef.current;
    if (!boost || boost.ctx.state === "closed") {
      const ctx = new AudioContextCtor();
      const gain = ctx.createGain();
      gain.gain.value = SPEAKER_BOOST_GAIN;
      gain.connect(ctx.destination);
      boost = { ctx, gain, source: null, stream: null };
      remoteAudioBoostRef.current = boost;
      void applySpeaker(speakerIdRef.current);
    }

    boost.gain.gain.value = SPEAKER_BOOST_GAIN;
    if (remoteStream && boost.stream !== remoteStream) {
      try {
        boost.source?.disconnect();
      } catch (e) {
        console.warn("Audio boost source disconnect failed", e);
      }
      try {
        boost.source = boost.ctx.createMediaStreamSource(remoteStream);
        boost.stream = remoteStream;
        boost.source.connect(boost.gain);
      } catch (e) {
        console.warn("Audio boost source setup failed", e);
        boost.source = null;
        boost.stream = null;
      }
    }

    if (boost.ctx.state === "suspended") {
      void boost.ctx.resume().catch((e: unknown) => console.warn("Audio boost resume failed", e));
    }

    return Boolean(boost.source);
  }

  function stopRemoteAudioBoost() {
    const boost = remoteAudioBoostRef.current;
    remoteAudioBoostRef.current = null;
    if (!boost) return;
    try {
      boost.source?.disconnect();
    } catch (e) {
      console.warn("Audio boost source disconnect failed", e);
    }
    try {
      boost.gain.disconnect();
    } catch (e) {
      console.warn("Audio boost gain disconnect failed", e);
    }
    if (boost.ctx.state !== "closed") {
      void boost.ctx.close().catch((e: unknown) => console.warn("Audio boost close failed", e));
    }
  }

  function setMutedState(nextMuted: boolean) {
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
  }

  function setSpeakerState(nextSpeakerOn: boolean) {
    speakerOnRef.current = nextSpeakerOn;
    setSpeakerOn(nextSpeakerOn);
  }

  function syncRemoteAudioPlayback() {
    const el = audioElRef.current;
    if (!el) return;
    if (speakerOnRef.current) {
      el.volume = 1;
      const boosted = ensureRemoteAudioBoost();
      el.muted = boosted;
    } else {
      stopRemoteAudioBoost();
      el.muted = false;
      if (el.volume == null || el.volume < 0.8) el.volume = 0.9;
    }
  }

  // Speakerphone toggle: when ON, push the remote audio volume to max so it
  // feels "loud" like a phone speaker. When OFF, restore normal playback.
  // On platforms that expose multiple output devices, we also try to switch
  // to a non-default speaker if available.
  async function toggleSpeaker() {
    const el = audioElRef.current;
    if (!el) {
      toast.error("Audio not ready yet");
      return;
    }
    if (speakerOnRef.current) {
      el.volume = lastDefaultVolumeRef.current;
      setSpeakerState(false);
      syncRemoteAudioPlayback();
      playRemoteAudio();
      toast.message("Speaker off");
    } else {
      lastDefaultVolumeRef.current = el.volume > 0 ? el.volume : 0.9;
      setSpeakerState(true);
      try {
        const availableSpeakers = speakers.length > 0 ? speakers : await loadSpeakers();
        const candidates = availableSpeakers
          .map((s) => s.deviceId)
          .filter((id) => id && id !== "default" && id !== "communications");
        if (candidates[0]) await applySpeaker(candidates[0]);
      } catch (e) {
        console.warn("speaker switch failed", e);
      }
      syncRemoteAudioPlayback();
      playRemoteAudio();
      toast.message("Speaker on");
    }
  }

  // ─── Tone player ──────────────────────────────────────────────────────────
  // Plays a 2-tone pattern (US-standard call progress tones) until stopped.
  // freqs: e.g. [440, 480] for ringback; [480, 620] for busy/reorder.
  // onMs / offMs: cadence. gain: 0..1, default 0.12 so it sits below voice.
  function markRemoteAudioHeard() {
    heardRemoteAudioRef.current = true;
    stopRingback();
  }

  function playRemoteAudio() {
    const el = audioElRef.current;
    if (!el) return;
    syncRemoteAudioPlayback();
    const playPromise = el.play?.();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((e: unknown) => {
        console.warn("remote audio playback blocked", e);
      });
    }
  }

  function finishProviderEndedCall() {
    if (cleanupRunningRef.current) return;
    setCallState("ending");
    void cleanup(activeAtRef.current ? "completed" : "no_answer");
  }

  function getLocalAudioTracks(call: WebrtcCallLike) {
    const tracks = new Set<MediaStreamTrack>();
    const localStream = call?.localStream as MediaStream | undefined;
    try {
      localStream?.getAudioTracks?.().forEach((track) => tracks.add(track));
    } catch (e) {
      console.warn("Could not read local audio stream tracks", e);
    }
    const pc = call?.peer?.instance as RTCPeerConnection | undefined | null;
    try {
      pc?.getSenders?.().forEach((sender) => {
        if (sender.track?.kind === "audio") tracks.add(sender.track);
      });
    } catch (e) {
      console.warn("Could not read outbound audio tracks", e);
    }
    return [...tracks];
  }

  function applyMuteToCall(call: WebrtcCallLike | null | undefined, nextMuted = mutedRef.current) {
    if (!call) return false;
    let applied = false;
    try {
      if (nextMuted) call.muteAudio?.();
      else call.unmuteAudio?.();
      applied = true;
    } catch (e) {
      console.warn("Telnyx mute toggle failed", e);
    }

    const tracks = getLocalAudioTracks(call);
    for (const track of tracks) {
      track.enabled = !nextMuted;
      applied = true;
    }
    return applied;
  }

  function attachRemoteAudio(call: WebrtcCallLike) {
    const el = audioElRef.current;
    if (!el || !call) return;
    const stream = call.remoteStream as MediaStream | undefined;
    if (stream && el.srcObject !== stream) {
      el.srcObject = stream;
    }
    // A real phone always plays whatever audio the carrier sends — ringback,
    // busy, "the number you have called", iPhone voicemail. So make sure the
    // <audio> sink is unmuted and at audible volume every time we (re)attach.
    syncRemoteAudioPlayback();
    if (stream?.getAudioTracks().length) {
      markRemoteAudioHeard();
    }
    applyMuteToCall(call, mutedRef.current);
    playRemoteAudio();

    const pc = call.peer?.instance as RTCPeerConnection | undefined | null;
    if (!pc || remoteTrackBindingsRef.current.has(pc)) return;
    remoteTrackBindingsRef.current.add(pc);
    const finishIfPeerClosed = () => {
      if (
        pc.connectionState === "closed" ||
        pc.signalingState === "closed" ||
        isTerminalTelnyxCallState(call.state)
      ) {
        finishProviderEndedCall();
      }
    };
    pc.addEventListener("connectionstatechange", finishIfPeerClosed);
    pc.addEventListener("signalingstatechange", finishIfPeerClosed);
    pc.addEventListener("track", (event) => {
      if (event.track.kind !== "audio") return;
      if (event.streams[0] && el.srcObject !== event.streams[0]) {
        el.srcObject = event.streams[0];
      }
      // Some carriers (especially mobile voicemail) start sending RTP a beat
      // before the SIP early-media event reaches us. Watch the track itself
      // so we kill the local ringback the instant real audio is flowing.
      event.track.addEventListener("unmute", markRemoteAudioHeard);
      event.track.addEventListener("ended", finishIfPeerClosed);
      markRemoteAudioHeard();
      playRemoteAudio();
    });
    // Watch ICE health. If the peer connection dies (the "TCF restart failed"
    // case from the console), the SDK eventually times out — but for the user
    // it just looks like a silent dead call. We surface it explicitly and try
    // an ICE restart once before giving up, the same way a phone retries.
    pc.addEventListener("iceconnectionstatechange", () => {
      const state = pc.iceConnectionState;
      if (state === "failed") {
        try {
          // Best-effort ICE restart. Both the SDK helper and the native API
          // exist depending on version, so try them in order.
          if (typeof call.updateMedia === "function") {
            call.updateMedia({ iceRestart: true });
          } else if (typeof pc.restartIce === "function") {
            pc.restartIce();
          }
        } catch (e) {
          console.warn("ICE restart failed", e);
        }
        // If we're still pre-answer when ICE collapses, give the user audible
        // + visual feedback instead of dead air.
        if (!activeAtRef.current && !heardRemoteAudioRef.current) {
          playReorderTone();
          toast.error("Network audio failed", {
            description:
              "Your network blocked the call media. Try a different network or disable VPN.",
          });
        }
      }
    });
  }

  function startTone(freqs: number[], onMs: number, offMs: number, gainValue = 0.12) {
    stopRingback();
    try {
      const Ctx: typeof AudioContext =
        (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      let cancelled = false;
      const loop = () => {
        if (cancelled) return;
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainValue, now + 0.02);
        gain.gain.setValueAtTime(gainValue, now + onMs / 1000 - 0.02);
        gain.gain.linearRampToValueAtTime(0, now + onMs / 1000);
        window.setTimeout(loop, onMs + offMs);
      };
      loop();
      ringCtxRef.current = {
        ctx,
        stop: () => {
          cancelled = true;
          try {
            oscs.forEach((o) => o.stop());
          } catch {}
          try {
            ctx.close();
          } catch {}
        },
      };
    } catch {}
  }

  function startRingback() {
    // US ringback: 440 + 480 Hz, 2s on / 4s off.
    startTone([440, 480], 2000, 4000);
  }
  function playBusyTone() {
    // US busy: 480 + 620 Hz, 0.5s on / 0.5s off. Auto-stop after 4s.
    startTone([480, 620], 500, 500);
    window.setTimeout(stopRingback, 4000);
  }
  function playReorderTone() {
    // US fast-busy / reorder: 480 + 620 Hz, 0.25s on / 0.25s off. Auto-stop after 3s.
    startTone([480, 620], 250, 250);
    window.setTimeout(stopRingback, 3000);
  }
  function stopRingback() {
    try {
      ringCtxRef.current?.stop();
    } catch {}
    ringCtxRef.current = null;
  }

  function startTimer() {
    setSeconds(0);
    const t0 = Date.now();
    startedAtRef.current = t0;
    activeAtRef.current = null;
    timerRef.current = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - t0) / 1000));
    }, 1000) as unknown as number;
  }

  async function cleanup(status: "completed" | "failed" | "no_answer") {
    // Guard against re-entry. The SDK fires "hangup"/"destroy" notifications
    // *while* we're tearing down the client, which would otherwise call
    // cleanup() again in a tight loop and freeze the page.
    if (cleanupRunningRef.current) return;
    cleanupRunningRef.current = true;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    stopRingback();
    const dur = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : 0;
    const id = callIdRef.current;
    // Detach listeners first so notifications fired during disconnect() are
    // ignored instead of re-triggering cleanup.
    const client = clientRef.current;
    callRef.current = null;
    clientRef.current = null;
    try {
      client?.off?.("telnyx.notification");
      client?.off?.("telnyx.ready");
      client?.off?.("telnyx.error");
      client?.off?.("telnyx.socket.error");
    } catch {}
    try {
      client?.disconnect?.();
    } catch {}
    stopRemoteAudioBoost();
    if (audioElRef.current) {
      audioElRef.current.muted = false;
      audioElRef.current.srcObject = null;
    }
    if (id) {
      try {
        const res = await finalizeCallRecord({
          call_id: id,
          duration_seconds: dur,
          status,
        });
        const at = res?.autoTopup;
        if (at && "mode" in at) {
          if (at.mode === "off_session") {
            toast.success("Auto top-up added to your balance");
          } else if (at.mode === "checkout_link" && at.checkoutUrl) {
            toast.message("Balance is low — tap to top up", {
              description: `One-click checkout for $${at.amount}`,
              action: {
                label: "Top up",
                onClick: () => window.open(at.checkoutUrl, "_blank", "noopener"),
              },
              duration: 15000,
            });
          }
        }
      } catch (e: any) {
        console.error(e);
      }
    }
    callIdRef.current = null;
    startedAtRef.current = null;
    activeAtRef.current = null;
    callStartLockedRef.current = false;
    setCallState("idle");
    setTelnyxState("");
    setSeconds(0);
    setMutedState(false);
    setSpeakerState(false);
    cleanupRunningRef.current = false;
  }

  function press(ch: string, sub?: string) {
    if (inCall) {
      if (callState === "active" && callRef.current?.dtmf) {
        try {
          callRef.current.dtmf(ch);
        } catch {}
      }
      return;
    }
    if (!/[\d*#]/.test(ch)) return;
    if (/\d/.test(ch) && raw.replace(/\D/g, "").length >= maxDigits) {
      toast.info(`Maximum ${maxDigits} digits for ${countryName(country)}`);
      return;
    }
    if (ch === "*" || ch === "#") {
      multitapRef.current = null;
      setAlphaInput((a) => a + ch);
      setRaw((r) => r + ch);
      return;
    }
    if (alpha && sub) {
      const now = Date.now();
      const last = multitapRef.current;
      if (last && last.k === ch && now - last.time < 900) {
        const idx = (last.idx + 1) % sub.length;
        multitapRef.current = { k: ch, idx, time: now };
        setAlphaInput((a) => a.slice(0, -1) + sub[idx]);
        return;
      }
      multitapRef.current = { k: ch, idx: 0, time: now };
      setAlphaInput((a) => a + sub[0]);
      setRaw((r) => sanitizeNationalDigits(r + ch, country));
      return;
    }
    multitapRef.current = null;
    setAlphaInput((a) => a + ch);
    setRaw((r) => sanitizeNationalDigits(r + ch, country));
  }

  function backspace() {
    multitapRef.current = null;
    setAlphaInput((a) => a.slice(0, -1));
    setRaw((r) => r.slice(0, -1));
  }

  function openAddContactDialog() {
    if (!raw) {
      toast.error("Enter a phone number first");
      return;
    }
    if (!isValid) {
      toast.error("Enter a valid phone number");
      return;
    }
    setContactName("");
    setContactCompany("");
    setContactOpen(true);
  }

  async function saveContact() {
    if (!user) return;
    if (!raw) {
      toast.error("Enter a phone number first");
      return;
    }
    if (!isValid) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Contact name is required");
      return;
    }
    setContactSaving(true);
    const { error } = await supabase.from("contacts").insert({
      user_id: user.id,
      name: contactName.trim(),
      phone: e164,
      company: contactCompany.trim() || null,
      email: null,
      website: null,
      tags: [],
      note: null,
    });
    setContactSaving(false);
    if (error) {
      toast.error("Could not add contact", { description: error.message });
      return;
    }
    toast.success("Contact added");
    setContactOpen(false);
  }

  async function startCall() {
    if (!isValid) return toast.error("Enter a valid number");
    if (
      callStartLockedRef.current ||
      cleanupRunningRef.current ||
      callState !== "idle" ||
      clientRef.current ||
      callRef.current
    ) {
      return;
    }
    callStartLockedRef.current = true;
    heardRemoteAudioRef.current = false;

    // Prime the <audio> sink inside the user gesture. Without this, Chrome's
    // autoplay policy can mute the very first chunk of carrier audio (the
    // start of an iPhone voicemail greeting, a busy tone, etc.) on the
    // grounds that the element "wasn't playing yet". Calling play() with no
    // srcObject is a no-op success and grants us the playback permission we
    // need a few moments later when the Telnyx remoteStream attaches.
    if (audioElRef.current) {
      audioElRef.current.muted = false;
      audioElRef.current.volume = 1;
      try {
        const p = audioElRef.current.play?.();
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as Promise<void>).catch(() => {});
        }
      } catch {}
    }

    const selectedCallerId =
      callFrom.kind === "custom" && callFrom.number ? callFrom.number : null;

    if (selectedCallerId && !isVerifiedCallerId(selectedCallerId, verifiedNumbers)) {
      let refreshedNumbers: VerifiedCallerId[];
      try {
        refreshedNumbers = await refreshVerifiedNumbers();
      } catch (e: any) {
        callStartLockedRef.current = false;
        toast.error("Could not check caller ID", {
          description: e?.message ?? "Try again in a moment.",
        });
        return;
      }
      if (!isVerifiedCallerId(selectedCallerId, refreshedNumbers)) {
        setCallFrom({ kind: "public" });
        callStartLockedRef.current = false;
        toast.error("Caller ID is not verified", {
          description: "Verify this number again before using it as caller ID.",
        });
        return;
      }
    }

    setCallState("connecting");
    setTelnyxState("connecting");
    // Visual timer starts on click (real phone behaviour).
    startTimer();
    startRingback();
    try {
      // populate speaker list (after gesture)
      loadSpeakers();
      const [{ username, password, publicCallerId }, mod] = await Promise.all([
        getWebrtcCredentials(),
        import("@telnyx/webrtc"),
      ]);
      const callerIdForCall = selectedCallerId ?? publicCallerId ?? null;
      if (callFrom.kind === "public" && !callerIdForCall) {
        throw new Error("Public caller ID is not configured on the server.");
      }
      const { id } = await startCallRecord({
        to_number: e164,
        from_number: callerIdForCall,
        country_code: detected,
        rate_per_minute: rate,
      });
      callIdRef.current = id;
      const client = new mod.TelnyxRTC({
        login: username,
        password,
        // Quiet the SDK so it doesn't spam the console with SIP/ICE traces
        // (which serialize huge objects and freeze DevTools-attached tabs).
        debug: false,
        logLevel: "warn" as any,
      } as any);
      clientRef.current = client;
      void applySpeaker(speakerIdRef.current);

      client.on("telnyx.ready", () => {
        if (clientRef.current !== client || callRef.current || cleanupRunningRef.current) return;
        setTelnyxState("dialing");
        const call = client.newCall({
          destinationNumber: e164,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } as any,
          remoteElement: "telnyx-remote-audio",
          speakerId: speakerIdRef.current,
          // Always pass the intended caller ID so connection-level defaults do
          // not replace a verified caller ID selection.
          ...(callerIdForCall
            ? {
                callerNumber: callerIdForCall,
                callerName: callerIdForCall,
              }
            : {}),
        });
        callRef.current = call;
        applyMuteToCall(call, mutedRef.current);
        attachRemoteAudio(call);
        setCallState("ringing");
      });
      client.on("telnyx.error", (err: any) => {
        console.error("telnyx.error", err);
        if (!heardRemoteAudioRef.current) playReorderTone();
        toast.error("Connection error", { description: err?.error?.message ?? String(err) });
        cleanup("failed");
      });
      client.on("telnyx.socket.error", (err: any) => {
        console.error("socket error", err);
        if (!heardRemoteAudioRef.current) playReorderTone();
        toast.error("Network error");
        cleanup("failed");
      });
      client.on("telnyx.notification", (n: any) => {
        if (n?.type !== "callUpdate" || !n.call) return;
        attachRemoteAudio(n.call);
        const s = normalizeTelnyxCallState(n.call.state);
        // Avoid re-rendering the (huge) dashboard tree on no-op updates.
        setTelnyxState((prev) => (prev === s ? prev : s));
        if (s === "active") {
          attachRemoteAudio(n.call);
          stopRingback();
          setCallState((p) => (p === "active" ? p : "active"));
          if (!activeAtRef.current) activeAtRef.current = Date.now();
        } else if (s === "early") {
          attachRemoteAudio(n.call);
          setCallState((p) => (p === "ringing" ? p : "ringing"));
        } else if (isTerminalTelnyxCallState(n.call.state)) {
          // Surface why the provider ended the call so we can debug profile
          // issues. Common causes: 21 normal, 16 normal_clearing, 487 timeout,
          // 603 declined, 503 service_unavailable (no outbound profile).
          const cause: string | undefined = n.call?.cause;
          const causeCode: string | number | undefined = n.call?.causeCode;
          const sipCode: string | number | undefined =
            n.call?.sipCode ?? n.call?.sip_code;
          const sipReason: string | undefined =
            n.call?.sipReason ?? n.call?.sip_reason;
          if (!activeAtRef.current && (cause || sipCode)) {
            console.warn("[telnyx] call ended pre-answer", {
              state: s,
              cause,
              causeCode,
              sipCode,
              sipReason,
              raw: n.call,
            });
            // Play the appropriate call-progress tone so the user gets the
            // same audible feedback as a regular phone.
            const codeNum = Number(sipCode);
            const causeStr = String(cause ?? "").toUpperCase();
            const shouldPlayFallbackTone = !heardRemoteAudioRef.current;
            if (codeNum === 486 || codeNum === 600 || causeStr === "USER_BUSY") {
              if (shouldPlayFallbackTone) playBusyTone();
              toast.error("Busy", {
                description: "The number is on another call. Try again later.",
              });
            } else if (
              codeNum === 480 ||
              codeNum === 408 ||
              codeNum === 487 ||
              causeStr === "NO_ANSWER" ||
              causeStr === "NO_USER_RESPONSE"
            ) {
              if (shouldPlayFallbackTone) playReorderTone();
              toast.message("No answer", {
                description: "The other side didn't pick up.",
              });
            } else {
              if (shouldPlayFallbackTone) playReorderTone();
              const routeRejectedVerifiedCallerId =
                Boolean(selectedCallerId) &&
                (codeNum === 482 ||
                  codeNum === 503 ||
                  causeStr === "EXCHANGE_ROUTING_ERROR" ||
                  String(sipReason ?? "")
                    .toLowerCase()
                    .includes("request merged"));
              if (routeRejectedVerifiedCallerId) {
                toast.error("Verified caller ID was rejected on this route", {
                  description:
                    "The destination carrier would not route this verified caller ID. Switch to Public number for this destination.",
                  action: {
                    label: "Use public",
                    onClick: () => setCallFrom({ kind: "public" }),
                  },
                });
              } else if (
                looksLikeProviderPolicyBlock({
                  cause,
                  causeCode,
                  sipCode,
                  sipReason,
                })
              ) {
                toast.error("Call blocked by voice provider", {
                  description:
                    "The provider rejected this destination or caller ID. Check your outbound profile and verified caller ID settings.",
                });
              } else {
                toast.error("Call ended by carrier", {
                  description: `${cause ?? "unknown"}${sipCode ? ` (SIP ${sipCode}${sipReason ? " " + sipReason : ""})` : ""}`,
                });
              }
            }
          }
          finishProviderEndedCall();
        } else if (s === "ringing" || s === "trying" || s === "requesting") {
          setCallState((p) => (p === "ringing" ? p : "ringing"));
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
    // Always stop the local ringback immediately so the UI feels responsive
    // even if the provider hangup ack is slow.
    stopRingback();
    if (callRef.current?.hangup) {
      try {
        callRef.current.hangup();
      } catch {}
      // Fallback: if the provider doesn't deliver a "hangup"/"destroy" notification
      // within 1s (e.g. carrier never replied), tear down anyway.
      setTimeout(() => {
        if (callRef.current || clientRef.current) {
          cleanup(activeAtRef.current ? "completed" : "no_answer");
        }
      }, 1000);
      return;
    }
    cleanup(activeAtRef.current ? "completed" : "no_answer");
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    const nextMuted = !mutedRef.current;
    setMutedState(nextMuted);
    applyMuteToCall(call, nextMuted);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const keyMeta: Record<string, string | undefined> = {
    "2": "ABC",
    "3": "DEF",
    "4": "GHI",
    "5": "JKL",
    "6": "MNO",
    "7": "PQRS",
    "8": "TUV",
    "9": "WXYZ",
    "0": "+",
  };
  const inCall = callState !== "idle";
  const registerTimerListener = useMemo(
    () => (fn: (s: number) => void) => {
      timerListenersRef.current.add(fn);
      fn(secondsRef.current);
      return () => {
        timerListenersRef.current.delete(fn);
      };
    },
    [],
  );

  function renderContactSearchCommand() {
    return (
      <Command
        filter={(value, search) => {
          const q = search.toLowerCase().trim();
          if (!q) return 1;
          return value.toLowerCase().includes(q) ? 1 : 0;
        }}
      >
        <CommandInput
          placeholder="Search by name or number..."
          value={contactQuery}
          onValueChange={setContactQuery}
        />
        <CommandList>
          <CommandEmpty>No contacts found.</CommandEmpty>
          <CommandGroup>
            {contacts.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.phone} ${c.company ?? ""}`}
                onSelect={() => selectContact(c.phone)}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{c.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground group-data-[selected=true]:text-primary-foreground/80">
                    {c.phone}
                  </span>
                </div>
                <Phone className="ml-2 h-3.5 w-3.5 text-primary" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  return (
    <div className="relative isolate flex min-h-[calc(100vh-56px)] w-full flex-col items-center justify-center gap-5 overflow-hidden px-4 py-4 md:min-h-[calc(100vh-1px)] md:py-6 lg:flex-row lg:items-stretch lg:justify-center">
      <audio
        id="telnyx-remote-audio"
        autoPlay
        playsInline
        preload="auto"
        onLoadedMetadata={() => playRemoteAudio()}
        onPlaying={markRemoteAudioHeard}
        ref={(el) => {
          audioElRef.current = el;
        }}
      />
      <div
        className={cn(
          "relative z-10 w-full shrink-0 self-center rounded-[2.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.035))] p-2.5 shadow-2xl shadow-black/35",
          "max-w-[340px] md:max-w-[380px]",
          panelOpen ? "lg:max-w-[360px]" : "lg:max-w-[420px]",
        )}
      >
        <div className="rounded-[2rem] border border-white/10 bg-background/95 p-4 shadow-inner shadow-black/20 lg:p-5">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            {/* Call from picker */}
            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-muted-foreground">Call from:</span>
              <Popover open={callFromOpen} onOpenChange={setCallFromOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={inCall}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {callFrom.kind === "public" ? (
                      <Globe className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Megaphone className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span>
                      {callFrom.kind === "public"
                        ? "Public number"
                        : callFrom.number ?? "Custom caller ID"}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[260px] border-white/10 bg-card/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
                >
                  <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Default options
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCallFrom({ kind: "public" });
                      setCallFromOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="flex-1">Public number</span>
                    {callFrom.kind === "public" && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  {verifiedNumbers.filter((v) => v.status === "verified").length > 0 && (
                    <>
                      <div className="mt-1.5 px-2 pt-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                        Your verified numbers
                      </div>
                      {verifiedNumbers
                        .filter((v) => v.status === "verified")
                        .map((v) => (
                          <div
                            key={v.phone_number}
                            className="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/[0.06]"
                          >
                            <Megaphone className="h-4 w-4 text-primary" />
                            <button
                              type="button"
                              onClick={() => {
                                setCallFrom({ kind: "custom", number: v.phone_number });
                                setCallFromOpen(false);
                              }}
                              className="flex-1 truncate text-left"
                            >
                              {v.phone_number}
                            </button>
                            {callFrom.kind === "custom" &&
                              callFrom.number === v.phone_number && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            <button
                              type="button"
                              aria-label={`Remove ${v.phone_number}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await removeVerifiedFn({
                                    data: { phone: v.phone_number },
                                  });
                                  if (
                                    callFrom.kind === "custom" &&
                                    callFrom.number === v.phone_number
                                  ) {
                                    setCallFrom({ kind: "public" });
                                  }
                                  await refreshVerifiedNumbers();
                                  toast.success("Number removed");
                                } catch (err: any) {
                                  toast.error(err?.message ?? "Could not remove");
                                }
                              }}
                              className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                    </>
                  )}
                  <div className="mt-1.5 px-2 pt-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Add caller ID
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCallFromOpen(false);
                      setVerifyStep("enter");
                      setVerifyNumber("");
                      setVerifyCode("");
                      setVerifyOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <Megaphone className="h-4 w-4 text-primary" />
                    <span className="flex-1">Verify a new number</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      FREE
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCallFromOpen(false);
                      setBuyOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span className="flex-1">Buy phone number</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      from $2/mo
                    </span>
                  </button>
                </PopoverContent>
              </Popover>
              </div>
              <Popover open={mobileContactSearchOpen} onOpenChange={setMobileContactSearchOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={inCall}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30 sm:hidden"
                    aria-label="Search contacts"
                    title="Search contacts"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[300px] border-white/10 bg-card/95 p-0 shadow-2xl shadow-black/40 backdrop-blur"
                >
                  {renderContactSearchCommand()}
                </PopoverContent>
              </Popover>
            </div>

            {/* Top row: country + number + backspace */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-2">
              <Popover
                open={countryOpen}
                onOpenChange={(open) => {
                  if (open) ensureCountries();
                  setCountryOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={inCall}
                    className="flex min-w-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-white/[0.08] disabled:opacity-50 sm:gap-1.5 sm:px-2.5"
                  >
                    <CountryFlag code={country} />
                    <span className="font-mono text-xs font-semibold text-foreground">
                      +{callingCode}
                    </span>
                    <ChevronsUpDown className="hidden h-3 w-3 opacity-60 sm:block" />
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
                              setRaw((value) => sanitizeNationalDigits(value, c.code));
                              setCountryOpen(false);
                            }}
                          >
                            <CountryFlag code={c.code} className="mr-2" />
                            <span className="w-6 text-xs font-semibold text-foreground group-data-[selected=true]:text-accent-foreground">
                              {c.code}
                            </span>
                            <span className="font-mono text-xs font-semibold text-foreground/80 group-data-[selected=true]:text-accent-foreground">
                              +{c.dial}
                            </span>
                            <span className="ml-3 flex-1 truncate">{c.name}</span>
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
                value={alpha ? alphaInput : formatted}
                onChange={(e) => {
                  if (alpha) {
                    setAlphaInput(e.target.value);
                    handlePhoneChange(e.target.value.replace(/[^\d+*#]/g, ""));
                  } else {
                    handlePhoneChange(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !inCall && (raw || (alpha && alphaInput))) {
                    e.preventDefault();
                    backspace();
                    return;
                  }
                  if (e.key === "Enter" && !inCall && isValid) {
                    e.preventDefault();
                    startCall();
                  }
                }}
                placeholder={alpha ? "Type letters" : "Phone number"}
                inputMode={alpha ? "text" : "tel"}
                disabled={inCall}
                className="h-8 min-w-0 border-0 border-b border-white/10 bg-transparent px-0 font-mono text-base tracking-wide shadow-none focus-visible:border-primary focus-visible:ring-0"
              />
              <Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={inCall}
                    className="hidden h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-30 sm:grid"
                    aria-label="Search contacts"
                    title="Search contacts"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[300px] border-white/10 bg-card/95 p-0 shadow-2xl shadow-black/40 backdrop-blur"
                >
                  <Command
                    filter={(value, search) => {
                      const q = search.toLowerCase().trim();
                      if (!q) return 1;
                      return value.toLowerCase().includes(q) ? 1 : 0;
                    }}
                  >
                    <CommandInput
                      placeholder="Search by name or number…"
                      value={contactQuery}
                      onValueChange={setContactQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No contacts found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.phone} ${c.company ?? ""}`}
                            onSelect={() => selectContact(c.phone)}
                          >
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm">{c.name}</span>
                              <span className="truncate font-mono text-xs text-muted-foreground group-data-[selected=true]:text-primary-foreground/80">
                                {c.phone}
                              </span>
                            </div>
                            <Phone className="ml-2 h-3.5 w-3.5 text-primary" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <button
                onClick={backspace}
                disabled={inCall || !raw}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-30"
                aria-label="Backspace"
              >
                <Delete className="h-4 w-4" />
              </button>
            </div>

            {/* Status line */}
            {inCall ? (
              <div className="mt-3 flex h-7 items-center justify-between rounded-full bg-white/[0.035] px-3 text-[11px] text-muted-foreground">
                <span className="uppercase tracking-wider">
                  {callState === "connecting" && "Connecting…"}
                  {callState === "ringing" && "Ringing…"}
                  {callState === "active" && "In call"}
                  {callState === "ending" && "Ending…"}
                </span>
                <CallTimer register={registerTimerListener} />
              </div>
            ) : (
              <button
                type="button"
                onClick={openAddContactDialog}
                disabled={!raw}
                className="mt-3 flex h-7 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.035] px-3 text-[11px] text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground disabled:opacity-40 disabled:hover:bg-white/[0.035] disabled:hover:text-muted-foreground"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Add contact</span>
              </button>
            )}
          </div>

          {/* Keypad */}
          <div className="mt-5 grid grid-cols-3 place-items-center gap-y-3 lg:gap-y-3.5">
            {keys.map((k) => {
              const sub = keyMeta[k];
              return (
                <button
                  key={k}
                  onClick={() => press(k, sub)}
                  className={cn(
                    "flex h-14 w-14 flex-col items-center justify-center rounded-full border border-white/10 bg-white/[0.045] shadow-sm transition hover:bg-white/[0.08] active:scale-95",
                    !panelOpen && "lg:h-[3.75rem] lg:w-[3.75rem]",
                  )}
                >
                  <span
                    className={cn(
                      "font-semibold leading-none",
                      alpha && sub
                        ? sub.length >= 4
                          ? "text-xs"
                          : "text-sm"
                        : cn("text-2xl", !panelOpen && "lg:text-[1.7rem]"),
                    )}
                  >
                    {alpha && sub ? sub : k}
                  </span>
                  {sub && !alpha && (
                    <span className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground">
                      {sub}
                    </span>
                  )}
                  {alpha && sub && (
                    <span className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground">
                      {k}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom action row */}
          <div className="mt-5 grid grid-cols-3 place-items-center">
            {inCall ? (
              <button
                onClick={toggleMute}
                disabled={callState === "connecting" || callState === "ending"}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-full border transition disabled:opacity-40",
                  muted
                    ? "border-primary/50 bg-primary/20 text-primary shadow-inner shadow-primary/20 hover:bg-primary/25"
                    : "border-white/10 bg-white/[0.045] text-muted-foreground hover:bg-white/[0.08]",
                )}
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Tap to unmute" : "Tap to mute"}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  multitapRef.current = null;
                  setAlpha((a) => {
                    const next = !a;
                    setAlphaInput(next ? raw : "");
                    return next;
                  });
                }}
                aria-label="Toggle letters"
                className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-xs font-semibold text-muted-foreground transition hover:bg-white/[0.08]"
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
                onClick={toggleSpeaker}
                disabled={callState === "ending"}
                aria-label={speakerOn ? "Speaker off" : "Speaker on"}
                title={speakerOn ? "Tap to disable speaker" : "Tap to enable speaker"}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-full border transition disabled:opacity-40",
                  speakerOn
                    ? "border-primary/50 bg-primary/20 text-primary shadow-inner shadow-primary/20 hover:bg-primary/25"
                    : "border-white/10 bg-white/[0.045] text-muted-foreground hover:bg-white/[0.08]",
                )}
              >
                <Volume2 className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={backspace}
                disabled={!raw}
                aria-label="Backspace"
                className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-muted-foreground transition hover:bg-white/[0.08] disabled:opacity-30"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>

          {telnyxState && inCall && (
            <div className="mt-3 rounded-full border border-white/10 bg-white/[0.03] py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
              call: {telnyxState}
            </div>
          )}
        </div>
      </div>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="border-white/10 bg-card/95 shadow-2xl shadow-black/40 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
            <DialogDescription>Save this dialed number to your Ringringa contacts.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dialer-contact-name">Name</Label>
              <Input
                id="dialer-contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dialer-contact-company">Company</Label>
              <Input
                id="dialer-contact-company"
                value={contactCompany}
                onChange={(e) => setContactCompany(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dialer-contact-phone">Phone number</Label>
              <Input id="dialer-contact-phone" value={e164} readOnly className="font-mono" />
              <p className="text-xs text-muted-foreground">
                {countryName(country)} supports {digitLimitLabel} for this dialer.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContactOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveContact} disabled={contactSaving}>
              {contactSaving ? "Saving..." : "Add contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom caller ID verification — 2 step */}
      <Dialog
        open={verifyOpen}
        onOpenChange={(o) => {
          setVerifyOpen(o);
          if (!o) {
            setVerifyNumber("");
            setVerifyCode("");
            setVerifyStep("enter");
          }
        }}
      >
        <DialogContent className="border-white/10 bg-card/95 shadow-2xl shadow-black/40 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {verifyStep === "enter" ? "Verify your phone number" : "Enter the code"}
            </DialogTitle>
            <DialogDescription>
              {verifyStep === "enter"
                ? "Use a number you own. We'll send a one-time code to confirm — then it's yours to use as caller ID."
                : `We just ${verifyMethod === "sms" ? "texted" : "called"} ${verifyNumber}. Enter the code below.`}
            </DialogDescription>
          </DialogHeader>
          {verifyStep === "enter" ? (
            <div className="grid gap-3">
              <Input
                value={verifyNumber}
                onChange={(e) => setVerifyNumber(e.target.value)}
                placeholder="+12125551234"
                inputMode="tel"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyMethod("sms")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition",
                    verifyMethod === "sms"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 text-muted-foreground hover:bg-white/[0.04]",
                  )}
                >
                  Send SMS code
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyMethod("call")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition",
                    verifyMethod === "call"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 text-muted-foreground hover:bg-white/[0.04]",
                  )}
                >
                  Call me with code
                </button>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                <div className="mb-1 inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="h-3.5 w-3.5" /> Note:
                </div>
                The number must accept SMS or voice calls so we can deliver the code. Standard
                carrier rates may apply on your side.
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoFocus
                className="font-mono text-lg tracking-widest"
              />
              <button
                type="button"
                className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setVerifyStep("enter");
                  setVerifyCode("");
                }}
              >
                Wrong number? Go back
              </button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>
              Cancel
            </Button>
            {verifyStep === "enter" ? (
              <Button
                disabled={verifySaving || !/^\+?\d{8,15}$/.test(verifyNumber.replace(/\s/g, ""))}
                onClick={async () => {
                  setVerifySaving(true);
                  try {
                    const res = await initiateCallerIdFn({
                      data: { phone: verifyNumber, method: verifyMethod },
                    });
                    setVerifyNumber(res.phone);
                    setVerifyStep("code");
                    toast.success(
                      verifyMethod === "sms"
                        ? `Code sent to ${res.phone}`
                        : `We're calling ${res.phone} now`,
                    );
                    await refreshVerifiedNumbers();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not start verification");
                  } finally {
                    setVerifySaving(false);
                  }
                }}
              >
                {verifySaving ? "Sending…" : "Send code"}
              </Button>
            ) : (
              <Button
                disabled={verifySaving || verifyCode.length < 4}
                onClick={async () => {
                  setVerifySaving(true);
                  try {
                    await confirmCallerIdFn({
                      data: { phone: verifyNumber, code: verifyCode },
                    });
                    setCallFrom({ kind: "custom", number: verifyNumber });
                    toast.success("Caller ID verified", {
                      description: `${verifyNumber} is now selected for outgoing calls.`,
                    });
                    await refreshVerifiedNumbers();
                    setVerifyOpen(false);
                    setVerifyNumber("");
                    setVerifyCode("");
                    setVerifyStep("enter");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Verification failed");
                  } finally {
                    setVerifySaving(false);
                  }
                }}
              >
                {verifySaving ? "Verifying…" : "Verify"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy phone number */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="border-white/10 bg-card/95 shadow-2xl shadow-black/40 sm:max-w-lg sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Purchase a new phone number to make and receive calls.</DialogTitle>
            <DialogDescription>
              Supporting documents might be required by our customer support team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
            <Select value={buyCountry} onValueChange={setBuyCountry}>
              <SelectTrigger className="h-10 border-white/10 bg-white/[0.045] text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUY_NUMBER_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="group">
                    <CountryFlag code={c.code} className="mr-2" />
                    <span className="w-6 text-xs font-semibold text-foreground group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground">
                      {c.code}
                    </span>{" "}
                    <span className="font-mono text-xs font-semibold text-foreground/85 group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground">
                      {c.dial}
                    </span>
                    <span className="ml-1 truncate font-medium text-foreground/90 group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground">
                      {countryName(c.code)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={buyAreaCode}
              onChange={(e) => setBuyAreaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter area code"
              onKeyDown={(e) => e.key === "Enter" && runNumberSearch()}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={runNumberSearch} disabled={buySearching}>
              <Search className="h-4 w-4" />
              {buySearching ? "Searching…" : "Search"}
            </Button>
          </div>

          {(buySearching || buyResults.length > 0) && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
              <div className="border-b border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-muted-foreground">
                Available Numbers
              </div>
              <ul className="max-h-[260px] divide-y divide-white/10 overflow-y-auto">
                {buySearching ? (
                  <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Searching…
                  </li>
                ) : (
                  buyResults.map((n) => (
                    <li
                      key={n.phone_number}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {n.phone_number.startsWith("+1") && n.phone_number.length === 12
                            ? `+1 ${n.phone_number.slice(2, 5)} ${n.phone_number.slice(5, 8)} ${n.phone_number.slice(8)}`
                            : n.phone_number}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${n.monthly_cost.toFixed(2)}/month
                          {n.region ? ` · ${n.region}` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => buyNumber(n)}
                        disabled={buying === n.phone_number}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {buying === n.phone_number ? "Buying…" : "Buy"}
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile: panel always visible below the dialer */}
      <div className="relative z-10 w-full lg:hidden">
        <CallNotesPanel inCall={inCall} peerNumber={e164} />
      </div>
      {/* Desktop: panel slides in beside the dialer when opened */}
      {panelOpen && (
        <div className="relative z-10 hidden lg:flex lg:items-stretch">
          <CallNotesPanel inCall={inCall} peerNumber={e164} onClose={() => setPanelOpen(false)} />
        </div>
      )}
      {/* Floating toggle: keeps the dialer centered when the panel is closed */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="group fixed right-6 top-6 z-30 hidden items-center gap-2 rounded-full border border-white/10 bg-card/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg shadow-black/20 backdrop-blur transition hover:bg-card hover:text-foreground lg:inline-flex"
          aria-label="Open script and notes"
          title="Open script & notes"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/20">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <span className="uppercase tracking-[0.15em]">Script &amp; Notes</span>
        </button>
      )}
    </div>
  );
}
