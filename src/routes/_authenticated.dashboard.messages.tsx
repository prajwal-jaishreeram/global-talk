import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Send, Inbox, Phone, ArrowLeft, Forward, Check, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";
import {
  listMyMessages,
  listMyPhoneNumbers,
  sendSms,
  forwardSmsMessage,
  updatePhoneNumberForwarding,
} from "@/lib/telnyx.functions";
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
  head: () => ({ meta: [{ title: "Messages — Ringringa" }] }),
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
  forward_to_number?: string | null;
  forward_sms_enabled?: boolean;
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function peer(m: Msg) {
  return m.direction === "inbound" ? m.from_number : m.to_number;
}

function mine(m: Msg) {
  return m.direction === "inbound" ? m.to_number : m.from_number;
}

export default function MessagesPage() {
  const { user } = useAuthState();
  const fetchMsgs = useServerFn(listMyMessages);
  const fetchNums = useServerFn(listMyPhoneNumbers);
  const send = useServerFn(sendSms);
  const forwardFn = useServerFn(forwardSmsMessage);
  const updateForwarding = useServerFn(updatePhoneNumberForwarding);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [nums, setNums] = useState<Owned[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null); // peer phone
  const [from, setFrom] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Forwarding settings card state
  const activeNumberObj = useMemo(
    () => nums.find((n) => n.phone_number === from) || nums[0],
    [nums, from],
  );
  const [forwardNumberInput, setForwardNumberInput] = useState("");
  const [forwardEnabledInput, setForwardEnabledInput] = useState(false);
  const [savingForward, setSavingForward] = useState(false);

  // Manual forwarding modal state
  const [forwardTargetMsg, setForwardTargetMsg] = useState<Msg | null>(null);
  const [forwardToNumber, setForwardToNumber] = useState("");
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
        setForwardNumberInput(currentNum.forward_to_number ?? "");
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
      setForwardNumberInput(selected.forward_to_number ?? "");
      setForwardEnabledInput(Boolean(selected.forward_sms_enabled));
    }
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

  const threads = useMemo(() => {
    const map = new Map<string, { peer: string; mine: string; last: Msg; unread: number }>();
    for (const m of msgs) {
      const p = peer(m);
      const existing = map.get(p);
      if (!existing) {
        map.set(p, { peer: p, mine: mine(m), last: m, unread: m.direction === "inbound" && !m.read_at ? 1 : 0 });
      } else {
        if (new Date(m.created_at) > new Date(existing.last.created_at)) existing.last = m;
        if (m.direction === "inbound" && !m.read_at) existing.unread += 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
    );
  }, [msgs]);

  const conversation = useMemo(() => {
    if (!active) return [];
    return msgs
      .filter((m) => peer(m) === active)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [msgs, active]);

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

  async function onSaveForwardSettings() {
    if (!activeNumberObj) return;
    setSavingForward(true);
    try {
      const res = await updateForwarding({
        data: {
          id: activeNumberObj.id,
          forward_to_number: forwardNumberInput.trim() || null,
          forward_sms_enabled: forwardEnabledInput,
        },
      });
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
      toast.success(
        forwardEnabledInput && res.forward_to_number
          ? `SMS will now be forwarded to ${res.forward_to_number}`
          : "Forwarding disabled",
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save forwarding settings");
    } finally {
      setSavingForward(false);
    }
  }

  async function onForward() {
    if (!forwardTargetMsg || !forwardToNumber.trim() || !forwardFromNumber) return;
    setForwarding(true);
    try {
      const forwardBody = `[Fwd from ${peer(forwardTargetMsg)}]: ${forwardTargetMsg.body}`;
      await forwardFn({
        data: {
          from: forwardFromNumber,
          to: forwardToNumber.trim(),
          body: forwardBody,
        },
      });
      toast.success(`Message forwarded to ${forwardToNumber.trim()}`);
      setForwardTargetMsg(null);
      setForwardToNumber("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Forwarding failed");
    } finally {
      setForwarding(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send, receive, and forward two-way SMS with your Ringringa phone numbers.
          </p>
        </div>
        {nums.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active Number:</span>
            <Select value={from} onValueChange={handleSenderChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nums.map((n) => (
                  <SelectItem key={n.id} value={n.phone_number}>
                    {n.phone_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {nums.length === 0 && !loading && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <Phone className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold">No phone number yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You need at least one phone number to send and receive text messages.
          </p>
          <a
            href="/dashboard/numbers"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Buy a number
          </a>
        </div>
      )}

      {/* Prominent SMS Auto-Forwarding Configuration Card */}
      {nums.length > 0 && (
        <div className="mt-6 rounded-2xl border border-primary/20 bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Forward className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">SMS & OTP Auto-Forwarding</h2>
                {activeNumberObj?.forward_sms_enabled && activeNumberObj?.forward_to_number ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active → {activeNumberObj.forward_to_number}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically forward any incoming SMS or OTP received on{" "}
                <span className="font-semibold text-foreground">{from || nums[0]?.phone_number}</span> directly to your personal mobile phone.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="toggle-forward"
                checked={forwardEnabledInput}
                onCheckedChange={setForwardEnabledInput}
              />
              <Label htmlFor="toggle-forward" className="text-xs font-medium cursor-pointer">
                {forwardEnabledInput ? "Forwarding Enabled" : "Forwarding Disabled"}
              </Label>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Forward to phone (e.g. +91 8605222604 or +1 415 555 2671)"
                value={forwardNumberInput}
                onChange={(e) => setForwardNumberInput(e.target.value)}
                className="text-xs"
              />
            </div>
            <Button
              size="sm"
              disabled={savingForward || (forwardEnabledInput && !forwardNumberInput.trim())}
              onClick={onSaveForwardSettings}
              className="gap-1.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              {savingForward ? "Saving…" : "Save Forward Number"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Any country or mobile carrier supported (e.g. Airtel, Jio, Vi, AT&T, Verizon, Vodafone).
          </p>
        </div>
      )}

      {nums.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
          {/* Threads list */}
          <div className="flex flex-col rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Conversations ({threads.length})
            </div>
            {threads.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Inbox className="mx-auto mb-2 h-6 w-6 opacity-50" />
                No messages yet.
              </div>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {threads.map((t) => (
                  <li key={t.peer}>
                    <button
                      onClick={() => {
                        setActive(t.peer);
                        handleSenderChange(t.mine);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-border/60 px-4 py-3 text-left text-sm hover:bg-accent/40",
                        active === t.peer && "bg-accent/60",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t.peer}</span>
                        <span className="text-xs text-muted-foreground">
                          {fmt(t.last.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {t.last.direction === "outbound" ? "You: " : ""}
                          {t.last.body || "(no text)"}
                        </span>
                        {t.unread > 0 && (
                          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                            {t.unread}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">to {t.mine}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Conversation */}
          <div
            className={cn(
              "flex flex-col rounded-2xl border border-border bg-card overflow-hidden min-h-[60vh]",
              !active && "hidden md:flex",
            )}
          >
            {!active ? (
              <div className="m-auto p-10 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-50" />
                Select a conversation to view messages
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <button
                    onClick={() => setActive(null)}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent md:hidden"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{active}</span>
                    <span className="text-xs text-muted-foreground">via {from}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {conversation.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "group flex items-end gap-2",
                        m.direction === "outbound" ? "justify-end" : "justify-start",
                      )}
                    >
                      {/* Left action button if outbound */}
                      {m.direction === "outbound" && (
                        <button
                          type="button"
                          onClick={() => {
                            setForwardTargetMsg(m);
                            setForwardFromNumber(mine(m) || from || nums[0]?.phone_number);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                          title="Forward this message"
                        >
                          <Forward className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                          m.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body || "(no text)"}</div>
                        <div
                          className={cn(
                            "mt-1 flex items-center justify-between gap-3 text-[10px]",
                            m.direction === "outbound"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          <span>{fmt(m.created_at)}</span>
                          {m.status === "forwarded" && (
                            <span className="font-medium underline decoration-dotted">Forwarded</span>
                          )}
                        </div>
                      </div>

                      {/* Right action button if inbound */}
                      {m.direction === "inbound" && (
                        <button
                          type="button"
                          onClick={() => {
                            setForwardTargetMsg(m);
                            setForwardFromNumber(mine(m) || from || nums[0]?.phone_number);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                          title="Forward this message"
                        >
                          <Forward className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSend();
                  }}
                  className="flex gap-2 border-t border-border p-3"
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={sending || !draft.trim()}>
                    <Send className="mr-2 h-4 w-4" /> Send
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual Forwarding Modal Dialog */}
      <Dialog
        open={Boolean(forwardTargetMsg)}
        onOpenChange={(open) => !open && setForwardTargetMsg(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-5 w-5 text-primary" />
              Forward Message
            </DialogTitle>
            <DialogDescription>
              Forward this text message to any mobile phone number worldwide.
            </DialogDescription>
          </DialogHeader>

          {forwardTargetMsg && (
            <div className="space-y-4 py-2">
              {/* Message preview */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <span className="font-semibold text-muted-foreground block mb-1">
                  Original from {peer(forwardTargetMsg)}:
                </span>
                <p className="italic text-foreground whitespace-pre-wrap">{forwardTargetMsg.body}</p>
              </div>

              {/* Destination phone input */}
              <div className="space-y-1.5">
                <Label htmlFor="forward-dest" className="text-xs">
                  Forward to phone number (with country code):
                </Label>
                <Input
                  id="forward-dest"
                  placeholder="e.g. +91 8605222604 or +1 415 555 2671"
                  value={forwardToNumber}
                  onChange={(e) => setForwardToNumber(e.target.value)}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Can be any personal mobile phone, SIM card, or WhatsApp phone worldwide.
                </p>
              </div>

              {/* Sender number picker */}
              {nums.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Send from your Ringringa number:</Label>
                  <Select value={forwardFromNumber} onValueChange={setForwardFromNumber}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nums.map((n) => (
                        <SelectItem key={n.id} value={n.phone_number}>
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
              onClick={() => setForwardTargetMsg(null)}
              disabled={forwarding}
            >
              Cancel
            </Button>
            <Button
              onClick={onForward}
              disabled={forwarding || !forwardToNumber.trim()}
              className="gap-1.5"
            >
              <Forward className="h-4 w-4" />
              {forwarding ? "Forwarding…" : "Send Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
