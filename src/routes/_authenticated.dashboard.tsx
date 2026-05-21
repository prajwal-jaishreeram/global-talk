import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, History, CreditCard, Settings, LogOut, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

type NavItem = {
  to: "/dashboard" | "/dashboard/history" | "/dashboard/credits" | "/dashboard/settings";
  label: string;
  icon: typeof Phone;
  exact?: boolean;
};
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dialer", icon: Phone, exact: true },
  { to: "/dashboard/history", label: "History", icon: History },
  { to: "/dashboard/credits", label: "Credits", icon: CreditCard },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [balance, setBalance] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", user.id)
        .maybeSingle();
      if (active && data) setBalance(Number(data.credit_balance));

      channel = supabase
        .channel(`profile:${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => {
            const next = (payload.new as { credit_balance?: number }).credit_balance;
            if (typeof next === "number") setBalance(next);
          },
        )
        .subscribe();
    }
    load();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Phone className="h-4 w-4" />
          </span>
          Ringlink
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Balance
          </div>
          <div className="mt-1 text-xl font-semibold">
            {balance === null ? "-" : `$${balance.toFixed(2)}`}
          </div>
          <Link to="/dashboard/credits">
            <Button size="sm" variant="outline" className="mt-2 w-full">Top up</Button>
          </Link>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{email}</span>
          <div className="flex items-center gap-1">
            <ThemeToggle className="h-7 w-7 rounded" />
            <button
              onClick={signOut}
              className="rounded p-1.5 hover:bg-sidebar-accent hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}