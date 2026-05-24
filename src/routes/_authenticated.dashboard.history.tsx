import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, Calendar, Clock, Globe, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CallRow = {
  id: string;
  to_number: string;
  from_number: string | null;
  country_code: string | null;
  status: string;
  duration_seconds: number;
  cost: number;
  rate_per_minute: number | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/dashboard/history")({
  head: () => ({ meta: [{ title: "Call history - Eginta" }] }),
  component: HistoryPage,
});

function formatPhone(n: string) {
  if (!n) return n;
  const m = n.match(/^\+(\d)(\d{3})(\d{3})(\d{4})$/);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return n;
}

function statusLabel(s: string) {
  if (s === "completed") return "Completed";
  if (s === "failed") return "Failed";
  if (s === "no-answer" || s === "no_answer") return "No answer";
  if (s === "busy") return "Busy";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  if (s === "initiated" || s === "ringing") return "Ringing";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusClasses(s: string) {
  if (s === "completed") return "bg-primary/10 text-primary border-primary/30";
  if (s === "failed" || s === "busy") return "bg-destructive/10 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1200);
      }}
      className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      title="Copy number"
      aria-label="Copy number"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function HistoryPage() {
  const [calls, setCalls] = useState<CallRow[] | null>(null);

  useEffect(() => {
    supabase
      .from("calls")
      .select("id, to_number, from_number, country_code, status, duration_seconds, cost, rate_per_minute, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setCalls((data as CallRow[]) ?? []));
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Call history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your last 100 calls.</p>

      <div className="mt-6 space-y-3">
        {calls === null ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : calls.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No calls yet. Your history will appear here.
          </div>
        ) : (
          calls.map((c) => {
            const date = new Date(c.created_at);
            const mins = Math.floor(c.duration_seconds / 60);
            const secs = c.duration_seconds % 60;
            const durationLabel =
              c.duration_seconds >= 60
                ? `${mins}:${String(secs).padStart(2, "0")} min`
                : `${secs}s`;
            const isInbound = false; // outbound-only for now
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: number + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-lg font-semibold tracking-tight">
                        {formatPhone(c.to_number)}
                      </div>
                      <a
                        href={`/dashboard?dial=${encodeURIComponent(c.to_number)}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call again
                      </a>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {date.toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                      {c.country_code && (
                        <span className="inline-flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5" />
                          {c.country_code}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                      {isInbound ? (
                        <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <PhoneOutgoing className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="text-muted-foreground">From:</span>
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {c.from_number ? formatPhone(c.from_number) : "Public number"}
                      </span>
                    </div>
                  </div>

                  {/* Right: status + duration + cost */}
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                          statusClasses(c.status),
                        )}
                      >
                        {statusLabel(c.status)}
                      </span>
                      <CopyBtn value={c.to_number} />
                    </div>
                    <div className="text-sm">
                      <div className="text-foreground">
                        <span className="text-muted-foreground">Duration: </span>
                        {durationLabel}
                      </div>
                      <div className="text-foreground">
                        <span className="text-muted-foreground">Cost: </span>$
                        {Number(c.cost).toFixed(2)}
                      </div>
                      {c.rate_per_minute ? (
                        <div className="text-xs text-muted-foreground">
                          ${Number(c.rate_per_minute).toFixed(3)}/min
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}