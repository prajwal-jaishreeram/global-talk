import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare,
  Send,
  Inbox,
  Phone,
  ArrowLeft,
  Forward,
  Check,
  Plus,
  Trash2,
  X,
  Loader2,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  ShieldCheck,
  Smartphone,
  Edit2,
  RefreshCw,
  Users,
  Filter,
  Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";
import {
  listMyMessages,
  listMyPhoneNumbers,
  sendSms,
  forwardSmsMessage,
  updatePhoneNumberForwarding,
  sendTestForwardingSms,
  type ForwardRecipient,
  type ForwardMode,
  type RecipientMessageType,
} from "@/lib/telnyx.functions";
import {
  parseForwardConfig,
  extractOtpCode,
  normalizeE164,
  DEFAULT_GROUPS,
} from "@/lib/forwarding";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages & Auto-Forwarding — Ringringa" }] }),
  component: MessagesPage,
});

type Msg = {
  id: string;
  to_number: string;
  from_number: string;
  body: string;
  direction: string;
  status: string;
  created_at: string;
  read_at: string | null;
};

type Owned = {
  id: string;
  phone_number: string;
  country_code: string | null;
  status: string;
  forward_to_number?: string | null;
  forward_sms_enabled?: boolean;
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function fmtTimeOnly(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function peer(m: Msg) {
  return m.direction === "inbound" ? m.from_number : m.to_number;
}

function mine(m: Msg) {
  return m.direction === "inbound" ? m.to_number : m.from_number;
}

function formatPhoneDisplay(num: string) {
  if (num.startsWith("+91") && num.length === 13) {
    return `+91 ${num.slice(3, 8)} ${num.slice(8)}`;
  }
  if (num.startsWith("+1") && num.length === 12) {
    return `+1 (${num.slice(2, 5)}) ${num.slice(5, 8)}-${num.slice(8)}`;
  }
  return num;
}

const MESSAGE_TYPE_LABELS: Record<RecipientMessageType, string> = {
  all: "All (Send & Receive)",
  inbound: "Inbound & OTPs Only",
  outbound: "Sent Copies Only",
  otp_only: "OTPs & Codes Only",
};

export default function MessagesPage() {
  const { user } = useAuthState();
  const fetchMsgs = useServerFn(listMyMessages);
  const fetchNums = useServerFn(listMyPhoneNumbers);
  const send = useServerFn(sendSms);
  const forwardFn = useServerFn(forwardSmsMessage);
  const updateForwarding = useServerFn(updatePhoneNumberForwarding);
  const sendTestSmsFn = useServerFn(sendTestForwardingSms);

  // Top-level navigation tabs: "inbox" | "forwarding"
  const [activeTab, setActiveTab] = useState<"inbox" | "forwarding">("inbox");

  // Minimized state for forwarding banner in Inbox tab
  const [isBannerMinimized, setIsBannerMinimized] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ringringa_fwd_banner_minimized") === "true";
    }
    return false;
  });

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [nums, setNums] = useState<Owned[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null); // peer phone
  const [from, setFrom] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Compose new SMS dialog state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composing, setComposing] = useState(false);

  // Conversation filter and search
  const [conversationFilter, setConversationFilter] = useState<"all" | "inbound" | "forwarded">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-Forwarding configuration state
  const activeNumberObj = useMemo(
    () => nums.find((n) => n.phone_number === from) || nums[0],
    [nums, from],
  );

  const [recipients, setRecipients] = useState<ForwardRecipient[]>([]);
  const [groups, setGroups] = useState<string[]>([...DEFAULT_GROUPS]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [forwardMode, setForwardMode] = useState<ForwardMode>("both");
  const [forwardEnabledInput, setForwardEnabledInput] = useState(false);
  const [savingForward, setSavingForward] = useState(false);
  const [testingForward, setTestingForward] = useState(false);

  // Form state to add new recipient
  const [newNumberPhone, setNewNumberPhone] = useState("");
  const [newNumberName, setNewNumberName] = useState("");
  const [newNumberGroup, setNewNumberGroup] = useState("Personal");
  const [newNumberMessageType, setNewNumberMessageType] = useState<RecipientMessageType>("all");

  // Create custom group modal
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");

  // Inline recipient rename state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  // Copied OTP state feedback
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);

  // Manual forwarding modal state
  const [forwardTargetMsg, setForwardTargetMsg] = useState<Msg | null>(null);
  const [manualRecipients, setManualRecipients] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [forwardFromNumber, setForwardFromNumber] = useState("");
  const [forwarding, setForwarding] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [m, n] = await Promise.all([fetchMsgs(), fetchNums()]);
      setMsgs(m.messages as Msg[]);
      const loadedNums = (n.numbers as any[]) ?? [];
      setNums(loadedNums);

      const defaultSender = from || loadedNums[0]?.phone_number || "";
      if (!from && loadedNums[0]) setFrom(loadedNums[0].phone_number);

      const currentNum = loadedNums.find((x: any) => x.phone_number === defaultSender);
      if (currentNum) {
        const config = parseForwardConfig(currentNum.forward_to_number);
        setRecipients(config.recipients);
        setGroups(config.groups);
        setForwardMode(config.mode);
        setForwardEnabledInput(Boolean(currentNum.forward_sms_enabled));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSenderChange(newFrom: string) {
    setFrom(newFrom);
    const selected = nums.find((x) => x.phone_number === newFrom);
    if (selected) {
      const config = parseForwardConfig(selected.forward_to_number);
      setRecipients(config.recipients);
      setGroups(config.groups);
      setForwardMode(config.mode);
      setForwardEnabledInput(Boolean(selected.forward_sms_enabled));
      setNewNumberPhone("");
      setNewNumberName("");
    }
  }

  function toggleBannerMinimized() {
    setIsBannerMinimized((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("ringringa_fwd_banner_minimized", String(next));
      }
      return next;
    });
  }

  // Realtime: new messages for this user
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`messages:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setMsgs((prev) => [payload.new as Msg, ...prev]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Filtered threads list
  const threads = useMemo(() => {
    const map = new Map<string, { peer: string; mine: string; last: Msg; unread: number; count: number }>();
    for (const m of msgs) {
      if (conversationFilter === "inbound" && m.direction !== "inbound") continue;
      if (conversationFilter === "forwarded" && m.status !== "forwarded") continue;

      const p = peer(m);

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPeer = p.toLowerCase().includes(q);
        const matchesBody = (m.body || "").toLowerCase().includes(q);
        if (!matchesPeer && !matchesBody) continue;
      }

      const existing = map.get(p);
      if (!existing) {
        map.set(p, {
          peer: p,
          mine: mine(m),
          last: m,
          unread: m.direction === "inbound" && !m.read_at ? 1 : 0,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (new Date(m.created_at) > new Date(existing.last.created_at)) {
          existing.last = m;
        }
        if (m.direction === "inbound" && !m.read_at) {
          existing.unread += 1;
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
    );
  }, [msgs, conversationFilter, searchQuery]);

  // Active conversation message list
  const conversation = useMemo(() => {
    if (!active) return [];
    return msgs
      .filter((m) => peer(m) === active)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [msgs, active]);

  // Total forwarded count for metrics
  const totalForwardedCount = useMemo(() => {
    return msgs.filter((m) => m.status === "forwarded").length;
  }, [msgs]);

  // Filtered recipients by group
  const filteredRecipients = useMemo(() => {
    if (selectedGroupFilter === "all") return recipients;
    return recipients.filter((r) => (r.group || "Personal") === selectedGroupFilter);
  }, [recipients, selectedGroupFilter]);

  async function onSend() {
    if (!draft.trim() || !active || !from) return;
    setSending(true);
    try {
      await send({ data: { from, to: active, body: draft.trim() } });
      setDraft("");
      toast.success("Message sent");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  // Compose new SMS to any number
  async function onComposeSend() {
    const rawTo = composeRecipient.trim();
    if (!rawTo || !composeBody.trim() || !from) return;

    const normalizedTo = normalizeE164(rawTo);
    if (!/^\+\d{7,16}$/.test(normalizedTo)) {
      toast.error("Please enter a valid recipient number with country code (e.g. +14155552671 or +918605222604)");
      return;
    }

    setComposing(true);
    try {
      await send({ data: { from, to: normalizedTo, body: composeBody.trim() } });
      toast.success("Message sent successfully!");
      setIsComposeOpen(false);
      setComposeRecipient("");
      setComposeBody("");
      setActive(normalizedTo);
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send message");
    } finally {
      setComposing(false);
    }
  }

  // Real-time persistence helper that saves recipients + groups + mode immediately
  async function persistForwarding(
    recipientsToSave: ForwardRecipient[],
    enabledToSave: boolean,
    modeToSave: ForwardMode = forwardMode,
    groupsToSave: string[] = groups,
    customSuccessMsg?: string,
  ) {
    if (!activeNumberObj) return;
    setSavingForward(true);
    try {
      const res = await updateForwarding({
        data: {
          id: activeNumberObj.id,
          recipients: recipientsToSave,
          groups: groupsToSave,
          mode: modeToSave,
          forward_sms_enabled: enabledToSave,
        },
      });

      const updatedConfig = parseForwardConfig(res.forward_to_number);
      setRecipients(updatedConfig.recipients);
      setGroups(updatedConfig.groups);
      setForwardMode(updatedConfig.mode);
      setForwardEnabledInput(res.forward_sms_enabled);

      setNums((prev) =>
        prev.map((item) =>
          item.id === activeNumberObj.id
            ? {
                ...item,
                forward_to_number: res.forward_to_number,
                forward_sms_enabled: res.forward_sms_enabled,
              }
            : item,
        ),
      );

      if (customSuccessMsg) toast.success(customSuccessMsg);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save forwarding settings");
    } finally {
      setSavingForward(false);
    }
  }

  // Adding a recipient saves immediately in real time
  async function addRecipient() {
    const rawNumber = newNumberPhone.trim();
    if (!rawNumber) {
      toast.error("Please enter a phone number.");
      return;
    }

    const normalized = normalizeE164(rawNumber);
    if (!/^\+\d{7,16}$/.test(normalized)) {
      toast.error("Please enter a valid phone number with country code (e.g. +91 8605222604 or +1 415 555 2671).");
      return;
    }

    if (recipients.some((r) => r.number === normalized)) {
      toast.info("This phone number is already in your forwarding list.");
      return;
    }

    const nextRecipients: ForwardRecipient[] = [
      ...recipients,
      {
        number: normalized,
        name: newNumberName.trim(),
        group: newNumberGroup || "Personal",
        messageType: newNumberMessageType,
        enabled: true,
      },
    ];

    setNewNumberPhone("");
    setNewNumberName("");

    await persistForwarding(
      nextRecipients,
      true,
      forwardMode,
      groups,
      `Added and saved ${normalized}! Auto-forwarding active.`,
    );
  }

  // Remove recipient saves immediately without error
  async function removeRecipient(index: number) {
    const target = recipients[index];
    const nextRecipients = recipients.filter((_, i) => i !== index);
    await persistForwarding(
      nextRecipients,
      nextRecipients.length > 0 ? forwardEnabledInput : false,
      forwardMode,
      groups,
      `Removed ${target?.name ? `${target.name} (${target.number})` : target?.number}.`,
    );
  }

  // Toggle recipient enabled/disabled individually
  async function toggleRecipientEnabled(index: number, newEnabled: boolean) {
    const nextRecipients = recipients.map((r, i) =>
      i === index ? { ...r, enabled: newEnabled } : r,
    );
    await persistForwarding(
      nextRecipients,
      forwardEnabledInput,
      forwardMode,
      groups,
      `Recipient ${newEnabled ? "enabled" : "paused"}.`,
    );
  }

  // Update recipient messageType rule (all | inbound | outbound | otp_only)
  async function updateRecipientMessageType(index: number, newType: RecipientMessageType) {
    const nextRecipients = recipients.map((r, i) =>
      i === index ? { ...r, messageType: newType } : r,
    );
    await persistForwarding(
      nextRecipients,
      forwardEnabledInput,
      forwardMode,
      groups,
      `Routing rule set to "${MESSAGE_TYPE_LABELS[newType]}".`,
    );
  }

  // Update recipient group
  async function updateRecipientGroup(index: number, newGroup: string) {
    const nextRecipients = recipients.map((r, i) =>
      i === index ? { ...r, group: newGroup } : r,
    );
    await persistForwarding(
      nextRecipients,
      forwardEnabledInput,
      forwardMode,
      groups,
      `Moved to group "${newGroup}".`,
    );
  }

  // Save edited name for recipient
  async function saveRecipientName(index: number) {
    if (editingIndex === null) return;
    const nextRecipients = recipients.map((r, i) =>
      i === index ? { ...r, name: editingNameValue.trim() } : r,
    );
    setEditingIndex(null);
    setEditingNameValue("");
    await persistForwarding(nextRecipients, forwardEnabledInput, forwardMode, groups, "Recipient name updated!");
  }

  // Toggle master switch saves immediately
  async function handleToggleSwitch(enabled: boolean) {
    if (enabled && recipients.length === 0 && !newNumberPhone.trim()) {
      toast.error("Please add at least one forwarding recipient before enabling auto-forwarding.");
      return;
    }

    let nextRecipients = [...recipients];
    if (enabled && newNumberPhone.trim()) {
      const normalized = normalizeE164(newNumberPhone.trim());
      if (/^\+\d{7,16}$/.test(normalized) && !nextRecipients.some((r) => r.number === normalized)) {
        nextRecipients.push({
          number: normalized,
          name: newNumberName.trim(),
          group: newNumberGroup || "Personal",
          messageType: newNumberMessageType,
          enabled: true,
        });
        setNewNumberPhone("");
        setNewNumberName("");
      }
    }

    setForwardEnabledInput(enabled);
    await persistForwarding(nextRecipients, enabled, forwardMode, groups);
  }

  // Toggle forwarding mode (both vs receive)
  async function handleModeChange(newMode: ForwardMode) {
    setForwardMode(newMode);
    await persistForwarding(
      recipients,
      forwardEnabledInput,
      newMode,
      groups,
      `Forwarding scope: ${newMode === "both" ? "Send & Receive" : "Receive Only"}`,
    );
  }

  // Add a new custom group
  async function addCustomGroup() {
    const name = newGroupNameInput.trim();
    if (!name) return;
    if (groups.includes(name)) {
      toast.info("Group already exists.");
      return;
    }
    const nextGroups = [...groups, name];
    setGroups(nextGroups);
    setNewGroupNameInput("");
    setIsCreateGroupOpen(false);
    await persistForwarding(recipients, forwardEnabledInput, forwardMode, nextGroups, `Group "${name}" created!`);
  }

  // Toggle all numbers in a specific group
  async function toggleGroupAll(groupName: string, enable: boolean) {
    const nextRecipients = recipients.map((r) =>
      (r.group || "Personal") === groupName ? { ...r, enabled: enable } : r,
    );
    await persistForwarding(
      nextRecipients,
      forwardEnabledInput,
      forwardMode,
      groups,
      `All numbers in group "${groupName}" ${enable ? "enabled" : "paused"}.`,
    );
  }

  // 1-Click Send Live Carrier Test SMS
  async function onSendTestSms() {
    if (!activeNumberObj) return;
    if (recipients.length === 0) {
      toast.error("Please add at least one forwarding recipient before running a test.");
      return;
    }
    setTestingForward(true);
    try {
      const res = await sendTestSmsFn({
        data: { phoneNumberId: activeNumberObj.id },
      });
      toast.success(
        `Carrier Test Sent! Successfully dispatched to ${res.succeeded}/${res.total} recipient${res.total > 1 ? "s" : ""}. Check your phones!`,
      );
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Test dispatch failed.");
    } finally {
      setTestingForward(false);
    }
  }

  // Copy OTP helper
  function handleCopyOtp(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedOtp(code);
    toast.success(`Copied verification code ${code} to clipboard!`);
    setTimeout(() => {
      setCopiedOtp(null);
    }, 2500);
  }

  // Manual forwarding modal logic
  function addManualRecipient() {
    const raw = manualInput.trim();
    if (!raw) return;
    const normalized = normalizeE164(raw);
    if (!/^\+\d{7,16}$/.test(normalized)) {
      toast.error("Please enter a valid phone number with country code.");
      return;
    }
    if (!manualRecipients.includes(normalized)) {
      setManualRecipients([...manualRecipients, normalized]);
    }
    setManualInput("");
  }

  async function onForward() {
    if (!forwardTargetMsg || !forwardFromNumber) return;

    let targets = [...manualRecipients];
    if (manualInput.trim()) {
      const norm = normalizeE164(manualInput.trim());
      if (/^\+\d{7,16}$/.test(norm) && !targets.includes(norm)) {
        targets.push(norm);
      }
    }

    if (targets.length === 0) {
      toast.error("Please specify at least one recipient phone number.");
      return;
    }

    setForwarding(true);
    try {
      const forwardBody = `[Fwd from ${peer(forwardTargetMsg)}]: ${forwardTargetMsg.body}`;
      const res = await forwardFn({
        data: {
          from: forwardFromNumber,
          to: targets,
          body: forwardBody,
        },
      });
      toast.success(
        `Message forwarded to ${res.succeeded ?? targets.length} recipient${targets.length > 1 ? "s" : ""}!`,
      );
      setForwardTargetMsg(null);
      setManualRecipients([]);
      setManualInput("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Forwarding failed");
    } finally {
      setForwarding(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">Messages</h1>
            {activeNumberObj?.forward_sms_enabled && recipients.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Forwarding Active
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Two-way SMS messaging, instant OTP copy, and real-time mobile forwarding with custom routing rules.
          </p>
        </div>

        {nums.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-1.5 px-3 shadow-2xs">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Active Virtual Number
                </span>
                <Select value={from} onValueChange={handleSenderChange}>
                  <SelectTrigger className="h-7 border-0 p-0 font-mono text-xs font-semibold focus:ring-0 shadow-none text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nums.map((n) => (
                      <SelectItem key={n.id} value={n.phone_number} className="font-mono text-xs">
                        {formatPhoneDisplay(n.phone_number)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {nums.length === 0 && !loading && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <Phone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <h3 className="text-lg font-semibold text-foreground">No Phone Number Purchased Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            You need a virtual phone number to receive verification SMS, OTPs, and route automated forwarding to your personal mobile.
          </p>
          <a
            href="/dashboard/numbers"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            Get a Phone Number
          </a>
        </div>
      )}

      {nums.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Main Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("inbox")}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === "inbox"
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Inbox & Messages</span>
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {threads.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("forwarding")}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === "forwarding"
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>Auto-Forwarding & Groups Hub</span>
                {recipients.length > 0 && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      forwardEnabledInput
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {recipients.length} {recipients.length === 1 ? "number" : "numbers"}
                  </span>
                )}
              </button>
            </div>

            {/* Test button in top bar */}
            {recipients.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSendTestSms}
                disabled={testingForward}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs h-8 border-border hover:bg-accent"
                title="Send a live test message to all configured forwarding recipients"
              >
                {testingForward ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                )}
                <span>Test Forwarding</span>
              </Button>
            )}
          </div>

          {/* TAB 1: INBOX & MESSAGES */}
          {activeTab === "inbox" && (
            <div className="space-y-4">
              {/* Minimizable / Collapsible Forwarding Card with DIRECT Add Number Feature */}
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xs transition-all">
                {isBannerMinimized ? (
                  // Minimized Sleek Pill Bar
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            forwardEnabledInput && recipients.length > 0
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40",
                          )}
                        />
                        <span className="font-semibold text-foreground">
                          Auto-Forwarding:
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            forwardEnabledInput && recipients.length > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {forwardEnabledInput && recipients.length > 0
                            ? `Active (${recipients.length} ${recipients.length === 1 ? "number" : "numbers"} · ${forwardMode === "both" ? "Send & Receive" : "Receive Only"})`
                            : "Disabled"}
                        </span>
                      </div>

                      {recipients.length > 0 && (
                        <div className="hidden md:flex items-center gap-1.5 overflow-hidden text-muted-foreground">
                          <span>→</span>
                          {recipients.slice(0, 3).map((r, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-background px-2 py-0.5 text-[11px] font-mono border border-border/60 truncate max-w-[140px] text-foreground/90"
                            >
                              {r.name ? `${r.name}: ` : ""}
                              {r.number}
                            </span>
                          ))}
                          {recipients.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{recipients.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={toggleBannerMinimized}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Expand auto-forwarding controls to add numbers"
                      >
                        <span>Expand Settings</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // Expanded Banner with DIRECT Add Number form right here!
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Forward className="h-4 w-4 text-primary" />
                          <h2 className="text-sm font-semibold text-foreground">SMS & OTP Auto-Forwarding</h2>
                          {forwardEnabledInput && recipients.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active ({recipients.length} recipient{recipients.length > 1 ? "s" : ""})
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              Disabled
                            </span>
                          )}
                          {savingForward && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary animate-pulse font-medium">
                              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Forward SMS & OTPs for virtual number <span className="font-semibold text-foreground font-mono">{from}</span> directly to your personal phones.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="banner-toggle"
                            checked={forwardEnabledInput}
                            onCheckedChange={handleToggleSwitch}
                            disabled={savingForward}
                          />
                          <Label htmlFor="banner-toggle" className="text-xs font-medium cursor-pointer text-foreground">
                            {forwardEnabledInput ? "Enabled" : "Disabled"}
                          </Label>
                        </div>

                        <button
                          type="button"
                          onClick={toggleBannerMinimized}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-2"
                          title="Minimize forwarding banner to save space"
                        >
                          <span>Minimize</span>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Scope Selector: Both Send & Receive vs Receive Only */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 p-2.5 px-3 border border-border/50 text-xs">
                      <span className="font-medium text-foreground">
                        Forwarding Scope:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleModeChange("both")}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border",
                            forwardMode === "both"
                              ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                              : "bg-background text-muted-foreground border-border hover:text-foreground",
                          )}
                        >
                          Send & Receive (Both)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeChange("receive")}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border",
                            forwardMode === "receive"
                              ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                              : "bg-background text-muted-foreground border-border hover:text-foreground",
                          )}
                        >
                          Receive Only (Inbound OTPs)
                        </button>
                      </div>
                    </div>

                    {/* List of configured recipient chips with individual toggle */}
                    {recipients.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider block">
                          Current Recipients ({recipients.length})
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {recipients.map((r, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs shadow-2xs transition-colors",
                                r.enabled !== false
                                  ? "bg-background border-border text-foreground"
                                  : "bg-muted/40 border-dashed border-border/60 text-muted-foreground opacity-60",
                              )}
                            >
                              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                              <div className="flex items-center gap-1 min-w-0">
                                {r.name && (
                                  <span className="font-semibold text-foreground truncate max-w-[100px]">{r.name}</span>
                                )}
                                <span className="font-mono text-foreground/90">{formatPhoneDisplay(r.number)}</span>
                              </div>

                              {/* Rule tag */}
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                                {r.messageType === "otp_only"
                                  ? "OTPs"
                                  : r.messageType === "outbound"
                                    ? "Sent"
                                    : r.messageType === "inbound"
                                      ? "Inbound"
                                      : "All"}
                              </span>

                              {/* Group badge */}
                              {r.group && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary font-medium">
                                  {r.group}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => removeRecipient(idx)}
                                disabled={savingForward}
                                className="text-muted-foreground hover:text-destructive p-0.5 ml-1 transition-colors"
                                title="Remove recipient"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DIRECT Inline Add Number Form Right Here (No redirect needed!) */}
                    <div className="rounded-xl border border-dashed border-border bg-background/50 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Add Forwarding Number
                        </span>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-muted-foreground text-[10px]">Prefix:</span>
                          <button
                            type="button"
                            onClick={() => setNewNumberPhone("+91 ")}
                            className="rounded px-1.5 py-0.5 text-[11px] font-mono bg-muted hover:bg-muted/80 text-foreground border border-border"
                          >
                            +91 (India)
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewNumberPhone("+1 ")}
                            className="rounded px-1.5 py-0.5 text-[11px] font-mono bg-muted hover:bg-muted/80 text-foreground border border-border"
                          >
                            +1 (US/CA)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <Input
                          placeholder="Phone number (e.g. +91 8605222604)"
                          value={newNumberPhone}
                          onChange={(e) => setNewNumberPhone(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addRecipient();
                            }
                          }}
                          className="text-xs font-mono sm:col-span-1"
                        />
                        <Input
                          placeholder="Name (e.g. Personal)"
                          value={newNumberName}
                          onChange={(e) => setNewNumberName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addRecipient();
                            }
                          }}
                          className="text-xs sm:col-span-1"
                        />
                        <Select value={newNumberGroup} onValueChange={setNewNumberGroup}>
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue placeholder="Group" />
                          </SelectTrigger>
                          <SelectContent>
                            {groups.map((g) => (
                              <SelectItem key={g} value={g} className="text-xs">
                                Group: {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex gap-2">
                          <Select
                            value={newNumberMessageType}
                            onValueChange={(val: any) => setNewNumberMessageType(val)}
                          >
                            <SelectTrigger className="text-xs h-9 flex-1">
                              <SelectValue placeholder="Forward Rule" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">All Messages (Both)</SelectItem>
                              <SelectItem value="inbound" className="text-xs">Inbound & OTPs Only</SelectItem>
                              <SelectItem value="outbound" className="text-xs">Sent Messages Only</SelectItem>
                              <SelectItem value="otp_only" className="text-xs">OTPs Only</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            size="sm"
                            onClick={addRecipient}
                            disabled={!newNumberPhone.trim() || savingForward}
                            className="text-xs gap-1 shrink-0 h-9 px-3"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2-Column Messaging Workspace */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
                {/* Left Column: Conversations List with Search, Filter & New Message Button */}
                <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
                  {/* Top Header with Compose New Message button */}
                  <div className="border-b border-border/80 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Conversations ({threads.length})
                      </span>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setIsComposeOpen(true)}
                        className="h-7 text-xs gap-1 px-2.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>New Message</span>
                      </Button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search conversations…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs bg-muted/30"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setConversationFilter("all")}
                        className={cn(
                          "rounded-md px-2 py-1 font-medium transition-colors",
                          conversationFilter === "all"
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setConversationFilter("inbound")}
                        className={cn(
                          "rounded-md px-2 py-1 font-medium transition-colors",
                          conversationFilter === "inbound"
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Received & OTPs
                      </button>
                      <button
                        type="button"
                        onClick={() => setConversationFilter("forwarded")}
                        className={cn(
                          "rounded-md px-2 py-1 font-medium transition-colors",
                          conversationFilter === "forwarded"
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Forwarded Log
                      </button>
                    </div>
                  </div>

                  {/* Threads List with High Contrast Legible Colors */}
                  {threads.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <Inbox className="mx-auto mb-2 h-7 w-7 opacity-40" />
                      <p className="font-medium text-xs text-foreground">No conversations found</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {searchQuery ? "Try another search term" : "Click '+ New Message' to start texting."}
                      </p>
                    </div>
                  ) : (
                    <ul className="max-h-[65vh] overflow-y-auto divide-y divide-border/40 [scrollbar-width:thin] [scrollbar-color:rgba(150,160,180,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                      {threads.map((t) => {
                        const otpCode = extractOtpCode(t.last.body);
                        const isSelected = active === t.peer;

                        return (
                          <li key={t.peer}>
                            <button
                              onClick={() => {
                                setActive(t.peer);
                                handleSenderChange(t.mine);
                              }}
                              className={cn(
                                "flex w-full flex-col gap-1.5 p-3.5 text-left text-xs transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent/50 text-foreground",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    "font-semibold font-mono",
                                    isSelected ? "text-white" : "text-foreground",
                                  )}
                                >
                                  {formatPhoneDisplay(t.peer)}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px]",
                                    isSelected ? "text-white/80" : "text-muted-foreground",
                                  )}
                                >
                                  {fmtTimeOnly(t.last.created_at)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "line-clamp-1 flex-1 font-normal",
                                    isSelected
                                      ? "text-white/95"
                                      : "text-foreground/85 dark:text-neutral-200",
                                  )}
                                >
                                  {t.last.direction === "outbound" ? (
                                    <span className={isSelected ? "text-white font-semibold" : "text-primary font-medium"}>
                                      You:{" "}
                                    </span>
                                  ) : null}
                                  {t.last.body || "(no text)"}
                                </span>
                                {t.unread > 0 && (
                                  <span
                                    className={cn(
                                      "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold shrink-0",
                                      isSelected
                                        ? "bg-white text-primary"
                                        : "bg-primary text-primary-foreground",
                                    )}
                                  >
                                    {t.unread}
                                  </span>
                                )}
                              </div>

                              <div
                                className={cn(
                                  "flex items-center justify-between text-[10px] pt-0.5",
                                  isSelected ? "text-white/75" : "text-muted-foreground",
                                )}
                              >
                                <span>via {t.mine}</span>
                                {otpCode && (
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.2 font-semibold text-[10px]",
                                      isSelected
                                        ? "bg-white/20 text-white"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                    )}
                                  >
                                    OTP Code
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Right Column: Chat Viewer & Quick Reply */}
                <div
                  className={cn(
                    "flex flex-col rounded-2xl border border-border bg-card overflow-hidden min-h-[65vh] shadow-2xs",
                    !active && "hidden md:flex",
                  )}
                >
                  {!active ? (
                    <div className="m-auto p-12 text-center text-sm text-muted-foreground">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                        <MessageSquare className="h-7 w-7 opacity-60" />
                      </div>
                      <h3 className="font-semibold text-base text-foreground">Select a conversation</h3>
                      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                        Choose any message thread from the left or click <strong>New Message</strong> to start texting.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Active Chat Header */}
                      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActive(null)}
                            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent md:hidden"
                            aria-label="Back"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm font-mono text-foreground">{formatPhoneDisplay(active)}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              Via virtual number {from}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const lastMsg = conversation[conversation.length - 1];
                            if (lastMsg) {
                              setForwardTargetMsg(lastMsg);
                              setForwardFromNumber(mine(lastMsg) || from);
                              setManualRecipients([]);
                              setManualInput("");
                            }
                          }}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Forward className="h-3.5 w-3.5" />
                          <span>Forward Message</span>
                        </Button>
                      </div>

                      {/* Chat Messages Feed with Sleek Scrollbar */}
                      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5 [scrollbar-width:thin] [scrollbar-color:rgba(150,160,180,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        {conversation.map((m) => {
                          const otpCode = extractOtpCode(m.body);
                          const isCopied = copiedOtp === otpCode;

                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "group flex items-end gap-2",
                                m.direction === "outbound" ? "justify-end" : "justify-start",
                              )}
                            >
                              {/* Left forward action for outbound messages */}
                              {m.direction === "outbound" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForwardTargetMsg(m);
                                    setForwardFromNumber(mine(m) || from);
                                    setManualRecipients([]);
                                    setManualInput("");
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground transition-opacity"
                                  title="Forward message"
                                >
                                  <Forward className="h-3.5 w-3.5" />
                                </button>
                              )}

                              <div
                                className={cn(
                                  "max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-2xs space-y-2",
                                  m.direction === "outbound"
                                    ? "bg-primary text-primary-foreground rounded-br-xs"
                                    : "bg-muted text-foreground dark:bg-neutral-800 dark:text-neutral-100 border border-border/70 rounded-bl-xs",
                                )}
                              >
                                {/* Message Body */}
                                <div className="whitespace-pre-wrap break-words leading-relaxed font-normal">
                                  {m.body || "(no text content)"}
                                </div>

                                {/* Smart OTP Detection Chip (Prominent 1-Click Copy) */}
                                {otpCode && (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyOtp(otpCode)}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-xs",
                                        m.direction === "outbound"
                                          ? "bg-white text-primary hover:bg-white/90"
                                          : isCopied
                                            ? "bg-emerald-600 text-white"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90",
                                      )}
                                      title="Click to copy verification OTP code"
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="h-3.5 w-3.5" />
                                          <span>Copied {otpCode}!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5" />
                                          <span>Copy Code: <span className="font-mono tracking-wider">{otpCode}</span></span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* Message Timestamp & Forwarded Status Tag */}
                                <div
                                  className={cn(
                                    "flex items-center justify-between gap-3 text-[10px] pt-0.5",
                                    m.direction === "outbound"
                                      ? "text-primary-foreground/75"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  <span>{fmt(m.created_at)}</span>
                                  {m.status === "forwarded" && (
                                    <span className="font-semibold inline-flex items-center gap-1 text-[10px] bg-primary/20 px-1.5 py-0.2 rounded">
                                      <Forward className="h-2.5 w-2.5" /> Forwarded
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right forward action for inbound messages */}
                              {m.direction === "inbound" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForwardTargetMsg(m);
                                    setForwardFromNumber(mine(m) || from);
                                    setManualRecipients([]);
                                    setManualInput("");
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground transition-opacity"
                                  title="Forward message"
                                >
                                  <Forward className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Message Composer */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          onSend();
                        }}
                        className="flex gap-2 border-t border-border p-3.5 bg-muted/10"
                      >
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Type an SMS reply…"
                          disabled={sending}
                          className="text-xs"
                        />
                        <Button type="submit" size="sm" disabled={sending || !draft.trim()} className="gap-1.5 px-4 text-xs shrink-0">
                          {sending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Send</span>
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUTO-FORWARDING & GROUPS HUB */}
          {activeTab === "forwarding" && (
            <div className="space-y-6">
              {/* Master Status Hero Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>
                      <h2 className="text-lg font-bold tracking-tight text-foreground">
                        Auto-Forwarding & Groups Hub
                      </h2>
                      {forwardEnabledInput && recipients.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Active & Routing Live
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Forwarding Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Create groups, configure custom routing rules per recipient, and decide exactly which phone numbers receive incoming OTPs, incoming SMS, or outgoing sent copies.
                    </p>
                  </div>

                  {/* Master Switch & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5 px-4 shadow-2xs">
                      <Switch
                        id="hub-master-switch"
                        checked={forwardEnabledInput}
                        onCheckedChange={handleToggleSwitch}
                        disabled={savingForward}
                      />
                      <Label htmlFor="hub-master-switch" className="text-xs font-semibold cursor-pointer text-foreground">
                        {forwardEnabledInput ? "Forwarding ON" : "Forwarding OFF"}
                      </Label>
                    </div>

                    <Button
                      variant="outline"
                      onClick={onSendTestSms}
                      disabled={testingForward || recipients.length === 0}
                      className="gap-2 text-xs shrink-0"
                      title="Test live SMS dispatch to all recipient numbers right now"
                    >
                      {testingForward ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      )}
                      <span>Test Forwarding</span>
                    </Button>
                  </div>
                </div>

                {/* Scope selector: Both Send & Receive vs Receive Only */}
                <div className="mt-5 border-t border-border/60 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">Master Forwarding Scope:</span>
                    <p className="text-muted-foreground text-[11px]">
                      Global setting for this virtual number. Individual recipient rules apply underneath.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange("both")}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                        forwardMode === "both"
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      Send & Receive (Both)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange("receive")}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                        forwardMode === "receive"
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      Receive Only (Inbound OTPs)
                    </button>
                  </div>
                </div>

                {/* Quick Info Grid */}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-border/60 pt-4">
                  <div className="flex items-center gap-3 rounded-xl bg-background/60 p-3 border border-border/40">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Source Virtual Number</span>
                      <p className="font-mono text-xs font-semibold text-foreground">{formatPhoneDisplay(from)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-background/60 p-3 border border-border/40">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Routing Precision</span>
                      <p className="text-xs font-semibold text-foreground">Custom Per-Recipient Filters</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-background/60 p-3 border border-border/40">
                    <Forward className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Total Forwarded</span>
                      <p className="text-xs font-semibold text-foreground">{totalForwardedCount} messages</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Groups Management Bar */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Filter by Group</h3>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateGroupOpen(true)}
                    className="h-8 text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create New Group</span>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedGroupFilter("all")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                      selectedGroupFilter === "all"
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-background text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    All Groups ({recipients.length})
                  </button>

                  {groups.map((g) => {
                    const count = recipients.filter((r) => (r.group || "Personal") === g).length;
                    const isSelected = selectedGroupFilter === g;

                    return (
                      <div key={g} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupFilter(g)}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                              : "bg-background text-muted-foreground border-border hover:text-foreground",
                          )}
                        >
                          {g} ({count})
                        </button>

                        {isSelected && count > 0 && (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => toggleGroupAll(g, true)}
                              className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground hover:text-foreground"
                              title="Enable all numbers in this group"
                            >
                              Enable All
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleGroupAll(g, false)}
                              className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground hover:text-foreground"
                              title="Pause all numbers in this group"
                            >
                              Pause All
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Forwarding Recipients Management */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-border/60 pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {selectedGroupFilter === "all"
                        ? `Configured Recipients (${recipients.length})`
                        : `Group "${selectedGroupFilter}" (${filteredRecipients.length})`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Customize what messages each phone receives: All, Inbound OTPs, or Sent copies.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {filteredRecipients.length} {filteredRecipients.length === 1 ? "Recipient" : "Recipients"}
                  </span>
                </div>

                {/* Recipients List Cards */}
                {filteredRecipients.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                    <Phone className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                    <p className="font-semibold text-foreground">No recipients found</p>
                    <p className="mt-0.5">
                      {selectedGroupFilter === "all"
                        ? "Add your mobile numbers below to configure automated forwarding."
                        : `No numbers in group "${selectedGroupFilter}". Add one below.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {filteredRecipients.map((r) => {
                      const idx = recipients.findIndex((item) => item.number === r.number);
                      const isEditing = editingIndex === idx;

                      return (
                        <div
                          key={r.number}
                          className={cn(
                            "flex flex-col justify-between gap-3.5 rounded-xl border p-4 shadow-2xs transition-all",
                            r.enabled !== false
                              ? "border-border/80 bg-background hover:border-primary/40"
                              : "border-border/50 bg-muted/20 opacity-70",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                                {idx + 1}
                              </span>

                              <div className="min-w-0">
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Input
                                      value={editingNameValue}
                                      onChange={(e) => setEditingNameValue(e.target.value)}
                                      placeholder="Nickname"
                                      className="h-7 text-xs w-36"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveRecipientName(idx);
                                        if (e.key === "Escape") setEditingIndex(null);
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => saveRecipientName(idx)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingIndex(null)}
                                      className="h-7 px-1.5 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs text-foreground truncate">
                                      {r.name || `Recipient #${idx + 1}`}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingIndex(idx);
                                        setEditingNameValue(r.name || "");
                                      }}
                                      className="text-muted-foreground hover:text-foreground p-0.5"
                                      title="Edit label/name"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}

                                <p className="font-mono text-xs text-foreground/80 mt-0.5">
                                  {formatPhoneDisplay(r.number)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Individual Enable / Pause switch */}
                              <div className="flex items-center gap-1.5" title={r.enabled !== false ? "Pause this number" : "Enable this number"}>
                                <Switch
                                  checked={r.enabled !== false}
                                  onCheckedChange={(val) => toggleRecipientEnabled(idx, val)}
                                  disabled={savingForward}
                                  className="scale-75"
                                />
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={savingForward}
                                onClick={() => removeRecipient(idx)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                title="Remove recipient"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Granular Routing & Group Controls */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                                Forward Rule
                              </span>
                              <Select
                                value={r.messageType || "all"}
                                onValueChange={(val: any) => updateRecipientMessageType(idx, val)}
                                disabled={savingForward}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all" className="text-xs">All Messages (Both)</SelectItem>
                                  <SelectItem value="inbound" className="text-xs">Inbound & OTPs Only</SelectItem>
                                  <SelectItem value="outbound" className="text-xs">Sent Messages Only</SelectItem>
                                  <SelectItem value="otp_only" className="text-xs">OTPs Only</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                                Group
                              </span>
                              <Select
                                value={r.group || "Personal"}
                                onValueChange={(val) => updateRecipientGroup(idx, val)}
                                disabled={savingForward}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {groups.map((g) => (
                                    <SelectItem key={g} value={g} className="text-xs">
                                      {g}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                            <span>
                              {r.number.startsWith("+91") ? "India (+91)" : r.number.startsWith("+1") ? "North America (+1)" : "International"}
                            </span>
                            <span className={r.enabled !== false ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                              {r.enabled !== false ? "Active" : "Paused"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Recipient Form */}
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Add New Forwarding Recipient
                    </Label>

                    {/* Quick country code prefix helpers */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">Quick Prefix:</span>
                      <button
                        type="button"
                        onClick={() => setNewNumberPhone("+91 ")}
                        className="rounded bg-background px-2 py-0.5 font-medium border border-border/80 hover:border-primary text-xs text-foreground font-mono"
                      >
                        +91 (India)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewNumberPhone("+1 ")}
                        className="rounded bg-background px-2 py-0.5 font-medium border border-border/80 hover:border-primary text-xs text-foreground font-mono"
                      >
                        +1 (US/CA)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="hub-recipient-phone" className="text-[11px] text-muted-foreground">
                        Phone Number *
                      </Label>
                      <Input
                        id="hub-recipient-phone"
                        placeholder="e.g. +91 8605222604"
                        value={newNumberPhone}
                        onChange={(e) => setNewNumberPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addRecipient();
                          }
                        }}
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="hub-recipient-name" className="text-[11px] text-muted-foreground">
                        Name / Label (Optional)
                      </Label>
                      <Input
                        id="hub-recipient-name"
                        placeholder="e.g. Personal Mobile"
                        value={newNumberName}
                        onChange={(e) => setNewNumberName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addRecipient();
                          }
                        }}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Assign to Group
                      </Label>
                      <Select value={newNumberGroup} onValueChange={setNewNumberGroup}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((g) => (
                            <SelectItem key={g} value={g} className="text-xs">
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Messages to Forward
                      </Label>
                      <Select
                        value={newNumberMessageType}
                        onValueChange={(val: any) => setNewNumberMessageType(val)}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All Messages (Both)</SelectItem>
                          <SelectItem value="inbound" className="text-xs">Inbound & OTPs Only</SelectItem>
                          <SelectItem value="outbound" className="text-xs">Sent Messages Only</SelectItem>
                          <SelectItem value="otp_only" className="text-xs">OTPs Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Saving adds the recipient and immediately enables routing according to your chosen rule.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addRecipient}
                      disabled={!newNumberPhone.trim() || savingForward}
                      className="gap-1.5 text-xs shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add & Save Recipient</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Forwarding Activity Log with Sleek Scrollbar */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Forwarding Activity Log</h3>
                    <p className="text-xs text-muted-foreground">
                      Recent messages auto-forwarded to your mobile devices.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refresh}
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refresh</span>
                  </Button>
                </div>

                {msgs.filter((m) => m.status === "forwarded").length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No forwarded messages logged yet. When an SMS arrives on {from}, forwarded messages will record here.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 max-h-72 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(150,160,180,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    {msgs
                      .filter((m) => m.status === "forwarded")
                      .slice(0, 20)
                      .map((m) => (
                        <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground font-mono">
                                To: {formatPhoneDisplay(m.to_number)}
                              </span>
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Delivered
                              </span>
                            </div>
                            <p className="line-clamp-1 text-foreground/80 text-[11px] font-normal">{m.body}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {fmt(m.created_at)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create New Group Modal */}
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Create New Group
            </DialogTitle>
            <DialogDescription>
              Create a named group (e.g. "Dev Team", "Accounting", "Emergency Alert SIMs") to organize your forwarding numbers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name-input" className="text-xs">
                Group Name:
              </Label>
              <Input
                id="group-name-input"
                placeholder="e.g. Core Team or Banking OTPs"
                value={newGroupNameInput}
                onChange={(e) => setNewGroupNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomGroup();
                  }
                }}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCustomGroup} disabled={!newGroupNameInput.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose New Message Modal */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <MessageSquare className="h-5 w-5 text-primary" />
              New SMS Message
            </DialogTitle>
            <DialogDescription>
              Send an SMS to any mobile phone number worldwide using your Ringringa virtual number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">From Virtual Number:</Label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-xs font-semibold text-foreground">
                {from}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compose-to" className="text-xs">
                To (Recipient Phone Number with Country Code):
              </Label>
              <Input
                id="compose-to"
                placeholder="e.g. +1 415 555 2671 or +91 8605222604"
                value={composeRecipient}
                onChange={(e) => setComposeRecipient(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compose-text" className="text-xs">
                Message Content:
              </Label>
              <textarea
                id="compose-text"
                rows={4}
                placeholder="Type your SMS message here…"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsComposeOpen(false)}
              disabled={composing}
            >
              Cancel
            </Button>
            <Button
              onClick={onComposeSend}
              disabled={composing || !composeRecipient.trim() || !composeBody.trim()}
              className="gap-1.5"
            >
              {composing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Send SMS</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Forwarding Modal Dialog */}
      <Dialog
        open={Boolean(forwardTargetMsg)}
        onOpenChange={(open) => {
          if (!open) {
            setForwardTargetMsg(null);
            setManualRecipients([]);
            setManualInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Forward className="h-5 w-5 text-primary" />
              Forward Message
            </DialogTitle>
            <DialogDescription>
              Forward this message to any mobile number worldwide.
            </DialogDescription>
          </DialogHeader>

          {forwardTargetMsg && (
            <div className="space-y-4 py-2">
              {/* Message preview */}
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1">
                <span className="font-semibold text-muted-foreground block text-[11px]">
                  Original from {peer(forwardTargetMsg)}:
                </span>
                <p className="italic text-foreground whitespace-pre-wrap font-normal">{forwardTargetMsg.body}</p>
              </div>

              {/* Target recipients chips */}
              <div className="space-y-2">
                <Label className="text-xs">
                  Recipients ({manualRecipients.length}):
                </Label>
                {manualRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 [scrollbar-width:thin]">
                    {manualRecipients.map((num, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium"
                      >
                        <Phone className="h-3 w-3 text-primary" />
                        <span className="font-mono">{num}</span>
                        <button
                          type="button"
                          onClick={() => setManualRecipients((prev) => prev.filter((_, i) => i !== idx))}
                          className="hover:text-destructive p-0.5 text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. +91 8605222604 (press Add or Enter)"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManualRecipient();
                      }
                    }}
                    className="text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addManualRecipient}
                    disabled={!manualInput.trim()}
                    className="gap-1 text-xs shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Sender number picker */}
              {nums.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Send from Ringringa number:</Label>
                  <Select value={forwardFromNumber} onValueChange={setForwardFromNumber}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nums.map((n) => (
                        <SelectItem key={n.id} value={n.phone_number} className="text-xs font-mono">
                          {n.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setForwardTargetMsg(null);
                setManualRecipients([]);
                setManualInput("");
              }}
              disabled={forwarding}
            >
              Cancel
            </Button>
            <Button
              onClick={onForward}
              disabled={forwarding || (manualRecipients.length === 0 && !manualInput.trim())}
              className="gap-1.5"
            >
              <Forward className="h-4 w-4" />
              {forwarding
                ? "Forwarding…"
                : `Send Forward (${Math.max(1, manualRecipients.length + (manualInput.trim() ? 1 : 0))})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
