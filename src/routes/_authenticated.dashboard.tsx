import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Phone,
  History,
  CreditCard,
  Settings,
  LogOut,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Users,
  Smartphone,
  MessageSquare,
  Headphones,
  Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyExact } from "@/lib/rates";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCreditBalance } from "@/hooks/use-credit-balance";
import logoUrl from "@/assets/logo and favicon/logo.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

type NavItem = {
  to:
    | "/dashboard"
    | "/dashboard/contacts"
    | "/dashboard/numbers"
    | "/dashboard/messages"
    | "/dashboard/rates"
    | "/dashboard/history"
    | "/dashboard/credits"
    | "/dashboard/settings"
    | "/dashboard/developers"
    | "/contact";
  label: string;
  icon: typeof Phone;
  exact?: boolean;
};
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Make a call", icon: Phone, exact: true },
  { to: "/dashboard/contacts", label: "Contacts", icon: Users },
  { to: "/dashboard/numbers", label: "Numbers", icon: Smartphone },
  { to: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/rates", label: "Rate calculator", icon: Calculator },
  { to: "/dashboard/history", label: "History", icon: History },
  { to: "/dashboard/credits", label: "Credits", icon: CreditCard },
  { to: "/dashboard/developers", label: "Developers", icon: Calculator },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
  { to: "/contact", label: "Support", icon: Headphones, exact: true },
];

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthState();
  const { balance } = useCreditBalance();
  const email = user?.email ?? null;
  // Start with the same value on server + client to avoid hydration mismatch.
  // The persisted preference is read on the next tick inside an effect.
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const collapsedHydratedRef = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // 1) On mount, restore the persisted sidebar state from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem("rl_sidebar_collapsed");
    if (persisted === "1") setCollapsed(true);
    collapsedHydratedRef.current = true;
  }, []);

  // 2) Persist user toggles, but only after the initial hydration read so we
  //    don't overwrite the stored value with the default "false".
  useEffect(() => {
    if (!collapsedHydratedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem("rl_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-white text-[#1C1C1B] dark:bg-[#0D0D11] dark:text-[#F3F3F5] transition-colors">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-white dark:bg-[#131317] p-3 transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn("mb-6 flex items-center", collapsed ? "flex-col gap-3" : "justify-between")}
        >
          {collapsed ? (
            <Link to="/" className="serif text-xl font-bold tracking-tighter" title="AGENTCALL">
              A<span className="text-[#8B6B55]">.</span>
            </Link>
          ) : (
            <Link to="/" className="serif text-xl font-semibold tracking-tighter text-foreground">
              AGENTCALL<span className="text-[#8B6B55]">.</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="grid h-8 w-8 place-items-center rounded-none text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-xs mono uppercase tracking-wider transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
        {collapsed ? (
          <div className="mt-4 flex shrink-0 flex-col items-center gap-2">
            <Link
              to="/dashboard/credits"
              className="grid h-9 w-9 place-items-center rounded-none text-muted-foreground hover:bg-muted hover:text-foreground"
              title={balance === null ? "Balance" : `Balance ${formatMoneyExact(balance)}`}
            >
              <Wallet className="h-4 w-4" />
            </Link>
            <ThemeToggle className="h-9 w-9 rounded-none border-border" />
            <button
              onClick={signOut}
              className="grid h-9 w-9 place-items-center rounded-none text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 shrink-0 border border-border bg-white dark:bg-[#1A1A20] p-3 shadow-2xs">
              <div className="flex items-center justify-between mono text-[10px] text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Wallet className="h-3 w-3" /> BALANCE</span>
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1 py-0.2">ACTIVE</span>
              </div>
              <div className="mt-1 text-lg serif font-light text-foreground">
                {balance === null ? "-" : formatMoneyExact(balance)}
              </div>
              <Link to="/dashboard/credits">
                <Button size="sm" className="mt-2 w-full bg-foreground text-background hover:opacity-90 mono text-[10px] uppercase tracking-wider h-7 cursor-pointer">
                  Top up credits
                </Button>
              </Link>
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-between gap-2 mono text-[10px] text-muted-foreground">
              <span className="truncate">{email}</span>
              <div className="flex items-center gap-1">
                <ThemeToggle className="h-7 w-7 rounded-none border-transparent p-0 hover:bg-muted text-muted-foreground" />
                <button
                  onClick={signOut}
                  className="p-1 hover:bg-muted hover:text-foreground text-muted-foreground cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      <div className="flex flex-1 flex-col overflow-x-clip bg-white dark:bg-[#0D0D11] transition-colors">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white dark:bg-[#131317] px-4 md:hidden">
          <Link to="/" className="serif text-xl font-semibold tracking-tighter text-foreground">
            AGENTCALL<span className="text-[#8B6B55]">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/credits"
              className="flex items-center gap-1.5 border border-border bg-background px-2.5 py-1 mono text-xs text-foreground"
            >
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {balance === null ? "-" : formatMoneyExact(balance)}
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center border border-border bg-background text-foreground cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-[#131317] p-4 shadow-xl flex flex-col border-r border-border">
              <div className="mb-6 flex items-center justify-between">
                <Link to="/" className="serif text-xl font-semibold tracking-tighter text-foreground">
                  AGENTCALL<span className="text-[#8B6B55]">.</span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid h-8 w-8 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
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
                  {balance === null ? "-" : formatMoneyExact(balance)}
                </div>
                <Link to="/dashboard/credits" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" variant="outline" className="mt-2 w-full">
                    Top up
                  </Button>
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
        <main className="relative flex-1 overflow-x-clip bg-background">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 hidden opacity-[0.1] md:block"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_36%),linear-gradient(180deg,transparent,rgba(255,255,255,0.025))] md:block"
          />
          <div className="relative z-10 min-h-[calc(100vh-56px)] md:min-h-screen">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
