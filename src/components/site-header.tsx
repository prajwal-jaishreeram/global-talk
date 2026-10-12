import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useAuthState } from "@/lib/auth-client";
import logoUrl from "@/assets/logo and favicon/logo.png";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { ready, isAuthenticated } = useAuthState();

  return (
    <header className="sticky top-0 z-40 border-b border-[#1C1C1B]/10 bg-[#F2F0EB]/90 backdrop-blur-md text-[#1C1C1B]">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="Ringringa" className="h-8 w-8 object-contain" />
          <span className="serif text-2xl font-semibold tracking-tight text-[#1C1C1B]">
            RINGRINGA.
          </span>
        </Link>

        <nav className="hidden items-center gap-8 mono text-xs uppercase tracking-wider text-[#1C1C1B]/70 md:flex">
          <Link to="/" hash="how" className="hover:text-[#1C1C1B] transition-colors">
            Protocol
          </Link>
          <Link to="/rates" className="hover:text-[#1C1C1B] transition-colors">
            Rates
          </Link>
          <Link to="/docs" className="hover:text-[#1C1C1B] transition-colors">
            API & MCP
          </Link>
          <Link to="/contact" className="hover:text-[#1C1C1B] transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {ready && isAuthenticated ? (
            <Link
              to="/dashboard"
              className="mono text-xs border border-[#1C1C1B] bg-[#1C1C1B] text-[#F2F0EB] px-4 py-2 hover:bg-transparent hover:text-[#1C1C1B] transition-all duration-200 flex items-center gap-1.5"
            >
              <span>DASHBOARD</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/auth/login"
                className="hidden sm:inline-block mono text-xs text-[#1C1C1B]/80 hover:text-[#1C1C1B] px-3 py-2"
              >
                LOGIN
              </Link>
              <Link
                to="/auth/signup"
                className="mono text-xs border border-[#1C1C1B] bg-[#1C1C1B] text-[#F2F0EB] px-5 py-2 hover:bg-transparent hover:text-[#1C1C1B] transition-all duration-200"
              >
                INITIALIZE
              </Link>
            </>
          )}

          <button
            className="grid h-9 w-9 place-items-center border border-[#1C1C1B]/20 md:hidden text-[#1C1C1B]"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[#1C1C1B]/10 bg-[#F2F0EB] px-8 py-5 mono text-xs uppercase tracking-wider md:hidden">
          <Link to="/" hash="how" onClick={() => setOpen(false)} className="py-1">
            Protocol
          </Link>
          <Link to="/rates" onClick={() => setOpen(false)} className="py-1">
            Rates
          </Link>
          <Link to="/docs" onClick={() => setOpen(false)} className="py-1">
            API & MCP
          </Link>
          <Link to="/contact" onClick={() => setOpen(false)} className="py-1">
            Contact
          </Link>
          <Link to="/auth/login" onClick={() => setOpen(false)} className="py-1">
            Login
          </Link>
        </div>
      )}
    </header>
  );
}
