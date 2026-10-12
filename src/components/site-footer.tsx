import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/logo and favicon/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-background text-foreground transition-colors">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logoUrl} alt="" className="h-8 w-8 object-contain" />
              <span className="serif text-xl font-semibold tracking-tight">
                AGENT CALL<span className="text-[#8B6B55]">.</span>
              </span>
            </Link>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed font-light">
              Give your AI agent a phone. Webhook and API-orchestrated telephony with human-in-the-loop connection.
            </p>
          </div>
          <div>
            <div className="mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Platform</div>
            <ul className="mt-3 space-y-2 text-xs font-light text-muted-foreground">
              <li>
                <Link to="/" hash="how" className="hover:text-foreground">
                  Protocol & Workflow
                </Link>
              </li>
              <li>
                <Link to="/rates" className="hover:text-foreground">
                  Per-Minute Rates
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-foreground">
                  Developer API & MCP
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Access</div>
            <ul className="mt-3 space-y-2 text-xs font-light text-muted-foreground">
              <li>
                <Link to="/auth/login" className="hover:text-foreground">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/auth/signup" className="hover:text-foreground">
                  Create Key
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-foreground">
                  Agent Dialer
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Security & Legal</div>
            <ul className="mt-3 space-y-2 text-xs font-light text-muted-foreground">
              <li>
                <Link to="/terms" className="hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  Support & Dispatch
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border/40 pt-6 mono text-[11px] text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} AGENT CALL TELEPHONY. ALL RIGHTS RESERVED.</div>
          <div className="flex gap-6">
            <span>ZERO AUDIO RECORDINGS</span>
            <span>END-TO-END TLS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
