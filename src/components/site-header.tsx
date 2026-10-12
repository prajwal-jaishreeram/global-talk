import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useAuthState } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import logoUrl from "@/assets/logo and favicon/logo.png";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { ready, isAuthenticated } = useAuthState();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-md text-foreground transition-colors">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="Ringringa" className="h-8 w-8 object-contain" />
          <span className="serif text-2xl font-semibold tracking-tight">
            RINGRINGA<span className="text-[#8B6B55]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 mono text-xs uppercase tracking-wider text-muted-foreground md:flex">
          <Link to="/" hash="how" className="hover:text-foreground transition-colors">
            Protocol
          </Link>
          <Link to="/rates" className="hover:text-foreground transition-colors">
            Rates
          </Link>
          <Link to="/docs" className="hover:text-foreground transition-colors">
            API & MCP
          </Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle className="h-8 w-8 border-border text-foreground hover:bg-muted" />

          {ready && isAuthenticated ? (
            <Link
              to="/dashboard"
              className="mono text-xs border border-foreground bg-foreground text-background px-4 py-2 hover:bg-transparent hover:text-foreground transition-all duration-200 flex items-center gap-1.5"
            >
              <span>DASHBOARD</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/auth/login"
                className="hidden sm:inline-block mono text-xs text-muted-foreground hover:text-foreground px-3 py-2"
              >
                LOGIN
              </Link>
              <Link
                to="/auth/signup"
                className="mono text-xs border border-foreground bg-foreground text-background px-5 py-2 hover:bg-transparent hover:text-foreground transition-all duration-200"
              >
                INITIALIZE
              </Link>
            </>
          )}

          <button
            className="grid h-9 w-9 place-items-center border border-border md:hidden text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border/40 bg-background px-8 py-5 mono text-xs uppercase tracking-wider text-muted-foreground md:hidden">
          <Link to="/" hash="how" onClick={() => setOpen(false)} className="py-1 hover:text-foreground">
            Protocol
          </Link>
          <Link to="/rates" onClick={() => setOpen(false)} className="py-1 hover:text-foreground">
            Rates
          </Link>
          <Link to="/docs" onClick={() => setOpen(false)} className="py-1 hover:text-foreground">
            API & MCP
          </Link>
          <Link to="/contact" onClick={() => setOpen(false)} className="py-1 hover:text-foreground">
            Contact
          </Link>
          <Link to="/auth/login" onClick={() => setOpen(false)} className="py-1 hover:text-foreground">
            Login
          </Link>
        </div>
      )}
    </header>
  );
}
