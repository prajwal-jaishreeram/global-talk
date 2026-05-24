import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Send, Inbox, Phone, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";
import { listMyMessages, listMyPhoneNumbers, sendSms } from "@/lib/telnyx.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages — Eginta" }] }),
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

type Owned = { id: string; phone_number: string };

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

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [nums, setNums] = useState<Owned[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null); // peer phone
  const [from, setFrom] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [m, n] = await Promise.all([fetchMsgs(), fetchNums()]);
      setMsgs(m.messages as Msg[]);
      setNums((n.numbers as any[]).map((x) => ({ id: x.id, phone_number: x.phone_number })));
      if (!from && n.numbers?.[0]) setFrom(n.numbers[0].phone_number);
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

  const hasNumbers = nums.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        {hasNumbers && (
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <span>Send from</span>
            <Select value={from} onValueChange={setFrom}>
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

      {!hasNumbers ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Phone className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Get a phone number to receive SMS</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Buy a virtual phone number and start receiving text messages directly here.
            Numbers start at just $1.95/month.
          </p>
          <a href="/dashboard/numbers" className="mt-5 inline-block">
            <Button>
              <Phone className="mr-2 h-4 w-4" /> Buy a Phone Number
            </Button>
          </a>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* Thread list */}
          <div
            className={cn(
              "rounded-2xl border border-border bg-card overflow-hidden",
              active && "hidden md:block",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
              <Inbox className="h-4 w-4 text-muted-foreground" /> Inbox
              <span className="ml-auto text-xs text-muted-foreground">{threads.length}</span>
            </div>
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No messages yet. Share your number to start receiving SMS.
              </div>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {threads.map((t) => (
                  <li key={t.peer}>
                    <button
                      onClick={() => {
                        setActive(t.peer);
                        setFrom(t.mine);
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
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {conversation.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.direction === "outbound" ? "justify-end" : "justify-start",
                      )}
                    >
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
                            "mt-1 text-[10px]",
                            m.direction === "outbound"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {fmt(m.created_at)}
                        </div>
                      </div>
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
    </div>
  );
}