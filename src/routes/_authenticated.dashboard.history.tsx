import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Calendar,
  Clock,
  Globe,
  Copy,
  Check,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatMoneyExact } from "@/lib/rates";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationFooter } from "@/components/pagination-footer";
import { CountryFlag } from "@/components/country-flag";

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
  head: () => ({ meta: [{ title: "Call history - AgentCall" }] }),
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

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryName(code: string) {
  return regionNames?.of(code) ?? code;
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

type DateRange = "all" | "today" | "7d" | "30d" | "90d" | "custom";
type StatusFilter = "all" | "completed" | "failed" | "no_answer";
const HISTORY_PAGE_SIZE = 10;

function HistoryPage() {
  const [calls, setCalls] = useState<CallRow[] | null>(null);
  const [contactMap, setContactMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const allCalls: CallRow[] = [];
      const chunkSize = 1000;
      let from = 0;

      while (!cancelled) {
        const { data, error } = await supabase
          .from("calls")
          .select(
            "id, to_number, from_number, country_code, status, duration_seconds, cost, rate_per_minute, created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, from + chunkSize - 1);

        if (error) {
          toast.error("Failed to load call history", { description: error.message });
          break;
        }

        const rows = (data as CallRow[]) ?? [];
        allCalls.push(...rows);
        if (rows.length < chunkSize) break;
        from += chunkSize;
      }

      const contactsRes = await supabase.from("contacts").select("name, phone");
      if (cancelled) return;
      setCalls(allCalls);
      const map: Record<string, string> = {};
      for (const c of (contactsRes.data as { name: string; phone: string }[]) ?? []) {
        if (c.phone) map[c.phone] = c.name;
      }
      setContactMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, country, range, fromDate, toDate, statusF]);

  const countries = useMemo(() => {
    if (!calls) return [] as string[];
    return Array.from(
      new Set(calls.map((c) => c.country_code).filter((x): x is string => !!x)),
    ).sort();
  }, [calls]);

  const filtered = useMemo(() => {
    if (!calls) return null;
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const now = Date.now();
    const rangeMs: Record<Exclude<DateRange, "custom">, number | null> = {
      all: null,
      today: 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };
    const cutoff = range !== "custom" ? rangeMs[range] : null;
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate
      ? new Date(toDate + "T23:59:59.999").getTime()
      : null;
    return calls.filter((c) => {
      // text search
      if (q) {
        const name = contactMap[c.to_number]?.toLowerCase() ?? "";
        const digits = c.to_number.replace(/\D/g, "");
        const hit =
          (qDigits && digits.includes(qDigits)) ||
          c.to_number.toLowerCase().includes(q) ||
          name.includes(q);
        if (!hit) return false;
      }
      if (country !== "all" && c.country_code !== country) return false;
      if (cutoff !== null && now - new Date(c.created_at).getTime() > cutoff) {
        return false;
      }
      const callTs = new Date(c.created_at).getTime();
      if (fromTs !== null && callTs < fromTs) return false;
      if (toTs !== null && callTs > toTs) return false;
      if (statusF !== "all") {
        const s = c.status === "no-answer" ? "no_answer" : c.status;
        if (s !== statusF) return false;
      }
      return true;
    });
  }, [calls, contactMap, query, country, range, fromDate, toDate, statusF]);

  const activeFilterCount =
    (country !== "all" ? 1 : 0) +
    (range !== "all" || fromDate || toDate ? 1 : 0) +
    (statusF !== "all" ? 1 : 0);
  const filteredCount = filtered?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCalls = filtered?.slice(
    (currentPage - 1) * HISTORY_PAGE_SIZE,
    currentPage * HISTORY_PAGE_SIZE,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Call history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your call history.</p>

      <div className="mt-5 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by number or contact name"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-primary"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterPill
          label="Date"
          value={range}
          options={[
            { value: "all", label: "All time" },
            { value: "today", label: "Last 24 hours" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
            { value: "90d", label: "Last 90 days" },
            { value: "custom", label: "Custom range" },
          ]}
          onChange={(v) => {
            setRange(v as DateRange);
            if (v !== "custom") {
              setFromDate("");
              setToDate("");
            }
          }}
        />
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-primary"
              placeholder="From"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-primary"
              placeholder="To"
            />
          </div>
        )}
        <FilterPill
          label="Country"
          value={country}
          options={[
            { value: "all", label: "All countries" },
            ...countries.map((c) => ({ value: c, label: countryName(c), countryCode: c })),
          ]}
          onChange={setCountry}
        />
        <FilterPill
          label="Status"
          value={statusF}
          options={[
            { value: "all", label: "All statuses" },
            { value: "completed", label: "Completed" },
            { value: "failed", label: "Failed" },
            { value: "no_answer", label: "No answer" },
          ]}
          onChange={(v) => setStatusF(v as StatusFilter)}
        />
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setCountry("all");
              setRange("all");
              setFromDate("");
              setToDate("");
              setStatusF("all");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {calls === null ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : calls.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No calls yet. Your history will appear here.
          </div>
        ) : filtered!.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No calls match <span className="font-medium text-foreground">"{query}"</span>.
          </div>
        ) : (
          pagedCalls!.map((c) => {
            const date = new Date(c.created_at);
            const mins = Math.floor(c.duration_seconds / 60);
            const secs = c.duration_seconds % 60;
            const durationLabel =
              c.duration_seconds >= 60
                ? `${mins}:${String(secs).padStart(2, "0")} min`
                : `${secs}s`;
            const isInbound = false; // outbound-only for now
            const contactName = contactMap[c.to_number];
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: number + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0">
                        {contactName && (
                          <div className="truncate text-base font-semibold tracking-tight text-foreground">
                            {contactName}
                          </div>
                        )}
                        <div
                          className={cn(
                            "truncate tracking-tight",
                            contactName
                              ? "text-sm font-medium text-muted-foreground"
                              : "text-lg font-semibold",
                          )}
                        >
                          {formatPhone(c.to_number)}
                        </div>
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
                          <CountryFlag code={c.country_code} />
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
                        <span className="text-muted-foreground">Cost: </span>
                        {formatMoneyExact(Number(c.cost))}
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

      {calls !== null && filteredCount > 0 && (
        <div className="mt-4">
          <PaginationFooter
            page={currentPage}
            pageSize={HISTORY_PAGE_SIZE}
            total={filteredCount}
            itemLabel="call"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

// Compact filter pill used in the history toolbar. Falls back to the shadcn
// Select primitive so it inherits keyboard support + theming.
function FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; countryCode?: string }[];
  onChange: (v: string) => void;
}) {
  const currentOption = options.find((o) => o.value === value);
  const current = currentOption?.label ?? label;
  const isActive = value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-8 w-auto gap-1.5 rounded-full border-border bg-card px-3 text-xs font-medium",
          isActive && "border-primary/50 bg-primary/10 text-primary",
        )}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {currentOption?.countryCode && <CountryFlag code={currentOption.countryCode} />}
          <SelectValue>{current}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.countryCode ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <CountryFlag code={o.countryCode} />
                <span className="w-6 text-xs font-semibold text-foreground">
                  {o.countryCode}
                </span>
                <span className="truncate text-muted-foreground">{o.label}</span>
              </span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
