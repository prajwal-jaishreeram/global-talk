import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/logo and favicon/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/50">
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
              <img src={logoUrl} alt="" className="h-9 w-9 object-contain" />
              Eginta
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Browser-native international calling for individuals and teams.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold">Quick links</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/" hash="how" className="hover:text-foreground">
                  How it works
                </Link>
              </li>
              <li>
                <Link to="/rates" className="hover:text-foreground">
                  Rates
                </Link>
              </li>
              <li>
                <Link to="/" hash="business" className="hover:text-foreground">
                  For business
                </Link>
              </li>
              <li>
                <Link to="/" hash="faq" className="hover:text-foreground">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Account</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/auth/login" className="hover:text-foreground">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/auth/signup" className="hover:text-foreground">
                  Sign up
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-foreground">
                  Make a call
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Legal</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/refund" className="hover:text-foreground">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Eginta. All rights reserved.</div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/refund" className="hover:text-foreground">
              Refund
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
