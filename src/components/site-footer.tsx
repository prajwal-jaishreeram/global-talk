import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/logo and favicon/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#1C1C1B]/10 bg-[#F2F0EB] text-[#1C1C1B]">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logoUrl} alt="" className="h-8 w-8 object-contain" />
              <span className="serif text-xl font-semibold tracking-tight">RINGRINGA.</span>
            </Link>
            <p className="mt-3 text-xs text-[#1C1C1B]/70 leading-relaxed font-light">
              Give your AI agent a phone. Webhook and API-orchestrated telephony with human-in-the-loop connection.
            </p>
          </div>
          <div>
            <div className="mono text-[11px] font-bold uppercase tracking-wider text-[#1C1C1B]/60">Platform</div>
            <ul className="mt-3 space-y-2 text-xs font-light text-[#1C1C1B]/80">
              <li>
                <Link to="/" hash="how" className="hover:text-black">
                  Protocol & Workflow
                </Link>
              </li>
              <li>
                <Link to="/rates" className="hover:text-black">
                  Per-Minute Rates
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-black">
                  Developer API & MCP
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="mono text-[11px] font-bold uppercase tracking-wider text-[#1C1C1B]/60">Access</div>
            <ul className="mt-3 space-y-2 text-xs font-light text-[#1C1C1B]/80">
              <li>
                <Link to="/auth/login" className="hover:text-black">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/auth/signup" className="hover:text-black">
                  Create Key
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-black">
                  Agent Dialer
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="mono text-[11px] font-bold uppercase tracking-wider text-[#1C1C1B]/60">Security & Legal</div>
            <ul className="mt-3 space-y-2 text-xs font-light text-[#1C1C1B]/80">
              <li>
                <Link to="/terms" className="hover:text-black">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-black">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-black">
                  Support & Dispatch
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#1C1C1B]/10 pt-6 mono text-[11px] text-[#1C1C1B]/60 md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} RINGRINGA TELEPHONY. ALL RIGHTS RESERVED.</div>
          <div className="flex gap-6">
            <span>ZERO AUDIO RECORDINGS</span>
            <span>END-TO-END TLS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
