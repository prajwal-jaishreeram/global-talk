import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthState } from "@/lib/auth-client";
import logoUrl from "@/assets/logo and favicon/logo.png";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { ready, isAuthenticated } = useAuthState();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <Link to="/" className="flex min-w-0 items-center gap-3 font-semibold">
          <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 object-contain sm:h-10 sm:w-10" />
          <span className="truncate text-xl font-bold tracking-tight sm:text-2xl">Ringringa</span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 text-sm text-muted-foreground shadow-sm md:flex">
          <Link
            to="/"
            hash="how"
            className="rounded-full px-3 py-1.5 hover:bg-white/[0.05] hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            to="/rates"
            className="rounded-full px-3 py-1.5 hover:bg-white/[0.05] hover:text-foreground"
          >
            Rates
          </Link>
          <Link
            to="/"
            hash="business"
            className="rounded-full px-3 py-1.5 hover:bg-white/[0.05] hover:text-foreground"
          >
            Business
          </Link>
          <Link
            to="/"
            hash="faq"
            className="rounded-full px-3 py-1.5 hover:bg-white/[0.05] hover:text-foreground"
          >
            FAQ
          </Link>
          <Link
            to="/contact"
            className="rounded-full px-3 py-1.5 hover:bg-white/[0.05] hover:text-foreground"
          >
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="h-10 w-10 rounded-xl sm:h-9 sm:w-9 sm:rounded-md" />
          {ready && isAuthenticated ? (
            <Link to="/dashboard">
              <Button
                size="sm"
                className="h-10 rounded-xl px-3 text-sm shadow-sm shadow-primary/10 sm:h-8 sm:rounded-md sm:px-3 sm:text-xs"
              >
                <PhoneCall className="h-4 w-4" /> Make a call
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button
                  size="sm"
                  className="h-10 rounded-xl px-3 text-sm shadow-sm shadow-primary/10 sm:h-8 sm:rounded-md sm:px-3 sm:text-xs"
                >
                  Get started
                </Button>
              </Link>
            </>
          )}
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-border sm:h-9 sm:w-9 sm:rounded-md md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-6 py-4 text-sm md:hidden">
          <Link to="/" hash="how" onClick={() => setOpen(false)}>
            How it works
          </Link>
          <Link to="/rates" onClick={() => setOpen(false)}>
            Rates
          </Link>
          <Link to="/" hash="business" onClick={() => setOpen(false)}>
            Business
          </Link>
          <Link to="/" hash="faq" onClick={() => setOpen(false)}>
            FAQ
          </Link>
          <Link to="/contact" onClick={() => setOpen(false)}>
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}
