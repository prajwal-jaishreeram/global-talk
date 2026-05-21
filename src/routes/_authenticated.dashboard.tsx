import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, History, CreditCard, Settings, LogOut, Wallet, PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("rl_sidebar_collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rl_sidebar_collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

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
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-sidebar p-3 md:flex transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Phone className="h-4 w-4" />
              </span>
              Ringlink
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
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
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
        {collapsed ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Link
              to="/dashboard/credits"
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title={balance === null ? "Balance" : `Balance $${balance.toFixed(2)}`}
            >
              <Wallet className="h-4 w-4" />
            </Link>
            <ThemeToggle className="h-9 w-9 rounded-md" />
            <button
              onClick={signOut}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </aside>

      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Phone className="h-4 w-4" />
            </span>
            Ringlink
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/credits"
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
            >
              <Wallet className="h-3.5 w-3.5" />
              {balance === null ? "-" : `$${balance.toFixed(2)}`}
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-md border border-border"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 bg-sidebar p-4 shadow-xl flex flex-col">
              <div className="mb-6 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 font-semibold">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Phone className="h-4 w-4" />
                  </span>
                  Ringlink
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1">
                {NAV.map((item) => {
                  const active = item.exact
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
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
                <Link to="/dashboard/credits" onClick={() => setMobileOpen(false)}>
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
            </div>
          </div>
        )}
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}