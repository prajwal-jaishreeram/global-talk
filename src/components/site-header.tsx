import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Phone className="h-4 w-4" />
          </span>
          Ringlink
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" hash="how" className="hover:text-foreground">How it works</Link>
          <Link to="/rates" className="hover:text-foreground">Rates</Link>
          <Link to="/" hash="business" className="hover:text-foreground">Business</Link>
          <Link to="/" hash="faq" className="hover:text-foreground">FAQ</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/auth/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/auth/signup">
            <Button size="sm">Get started</Button>
          </Link>
          <button
            className="md:hidden grid h-9 w-9 place-items-center rounded-md border border-border"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border/60 px-6 py-3 flex flex-col gap-3 text-sm">
          <Link to="/" hash="how" onClick={() => setOpen(false)}>How it works</Link>
          <Link to="/rates" onClick={() => setOpen(false)}>Rates</Link>
          <Link to="/" hash="business" onClick={() => setOpen(false)}>Business</Link>
          <Link to="/" hash="faq" onClick={() => setOpen(false)}>FAQ</Link>
          <Link to="/contact" onClick={() => setOpen(false)}>Contact</Link>
        </div>
      )}
    </header>
  );
}
