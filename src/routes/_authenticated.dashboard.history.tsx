import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CallRow = {
  id: string;
  to_number: string;
  country_code: string | null;
  status: string;
  duration_seconds: number;
  cost: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/dashboard/history")({
  head: () => ({ meta: [{ title: "Call history - Ringlink" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [calls, setCalls] = useState<CallRow[] | null>(null);

  useEffect(() => {
    supabase
      .from("calls")
      .select("id, to_number, country_code, status, duration_seconds, cost, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setCalls((data as CallRow[]) ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Call history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your last 100 calls.</p>

      <div className="mt-6 rounded-2xl border border-border bg-card">
        {calls === null ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : calls.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No calls yet. Your history will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {calls.map((c) => {
              const date = new Date(c.created_at);
              const mins = Math.floor(c.duration_seconds / 60);
              const secs = c.duration_seconds % 60;
              const failed = c.status !== "completed";
              return (
                <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${failed ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                    {failed ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{c.to_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {date.toLocaleString()} · {c.country_code ?? "-"}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{mins}m {secs}s</div>
                    <div className="text-xs text-muted-foreground">${Number(c.cost).toFixed(2)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}