import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Key, Phone, Webhook, Code, Bot, ShieldCheck, Copy, Check, Terminal, ExternalLink } from "lucide-react";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [{ title: "Developer API & Documentation - Ringringa" }] }),
  component: DocsPage,
});

function DocsPage() {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const quickPrompt = `You are integrated with Ringringa calling API.
Your goal is to place outbound phone calls through Ringringa.

Configuration:
- Base API URL: https://ringringa.com/api/v1
- Documentation: https://ringringa.com/llms.txt
- OpenAPI Spec: https://ringringa.com/openapi.yaml

How to queue a call:
POST https://ringringa.com/api/v1/calls
Headers:
  Authorization: Bearer <YOUR_API_KEY>
  Content-Type: application/json
Body JSON:
{
  "to": "+14155552671",
  "goal": "Introduce our AI product",
  "script": "Hello! I am calling on behalf of...",
  "notes": "Follow up on email sent yesterday",
  "consent_attestation": true
}`;

  function handleCopy() {
    navigator.clipboard.writeText(quickPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  return (
    <div className="min-h-screen bg-white text-[#1C1C1B] dark:bg-[#0D0D11] dark:text-[#F3F3F5] transition-colors flex flex-col font-sans">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-12 flex-1 w-full">
        {/* Header */}
        <div className="border-b border-border pb-8 mb-10">
          <div className="mono text-[11px] text-[#8B6B55] dark:text-[#C9A690] uppercase tracking-widest font-semibold mb-3">
            ◆ DEVELOPER PROTOCOL & SPECIFICATIONS
          </div>
          <h1 className="serif text-4xl sm:text-5xl font-light tracking-tight text-foreground">
            Ringringa Agent API
          </h1>
          <p className="mt-3 text-base text-muted-foreground font-light leading-relaxed max-w-2xl">
            Give your AI agent a phone. Trigger telephone calls programmatically from Claude, ChatGPT, n8n, Make, or custom python scripts with human-in-the-loop connection.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 mono text-xs">
            <a
              href="/openapi.yaml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 hover:bg-muted transition-colors"
            >
              <span>OPENAPI_SPEC</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/llms.txt"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 hover:bg-muted transition-colors"
            >
              <span>LLMS.TXT</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="space-y-12">
          {/* Quickstart */}
          <section className="border border-border bg-[#F8F9FA] dark:bg-[#16161B] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-dashed border-border gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#8B6B55] dark:text-[#C9A690]" />
                <span className="mono text-xs font-bold uppercase tracking-wider text-foreground">
                  01 · 5-Minute Agent Auto-Setup Prompt
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="mono text-[11px] border border-border px-3 py-1 bg-background text-foreground hover:bg-foreground hover:text-background transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedPrompt ? "COPIED" : "COPY PROMPT"}</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground font-light mb-3">
              Copy and paste this snippet directly into Claude, Cursor, ChatGPT, or your automation prompt to configure the agent instantly:
            </p>
            <pre className="mono text-[11px] bg-black/5 dark:bg-white/5 p-4 rounded border border-border overflow-x-auto text-foreground whitespace-pre leading-relaxed select-all">
              {quickPrompt}
            </pre>
          </section>

          {/* Authentication */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="mono text-sm font-semibold text-muted-foreground/60">02</span>
              <h2 className="serif text-2xl font-light text-foreground">Authentication & Key Modes</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every request must include your secret API key as a Bearer token in the <code>Authorization</code> header:
            </p>
            <pre className="mono text-xs bg-background border border-border p-3 text-foreground">
              Authorization: Bearer rg_live_9a7f3e82c1...
            </pre>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="border border-border bg-[#F8F9FA] dark:bg-[#16161B] p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-xs font-bold text-emerald-600 dark:text-emerald-400">rg_live_</span>
                  <span className="mono text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">REAL PSTN</span>
                </div>
                <h3 className="serif text-base font-semibold mb-1 text-foreground">Live Telephony Keys</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  Triggers real PSTN calls to carriers globally. Deducts per-second usage from prepaid balance with atomic holds.
                </p>
              </div>
              <div className="border border-border bg-[#F8F9FA] dark:bg-[#16161B] p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-xs font-bold text-blue-600 dark:text-blue-400">rg_test_</span>
                  <span className="mono text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-bold">SANDBOX</span>
                </div>
                <h3 className="serif text-base font-semibold mb-1 text-foreground">Test & Simulation Keys</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  Simulates complete lifecycle callbacks and webhooks without charging balance or initiating outbound trunks.
                </p>
              </div>
            </div>
          </section>

          {/* Endpoints */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="mono text-sm font-semibold text-muted-foreground/60">03</span>
              <h2 className="serif text-2xl font-light text-foreground">Core REST Endpoints</h2>
            </div>

            <div className="border border-border bg-[#F8F9FA] dark:bg-[#16161B] divide-y divide-border overflow-hidden text-xs mono">
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">POST /api/v1/calls</span>
                <span className="text-muted-foreground">Queue call task with number, goal, script & consent attestation</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">GET /api/v1/calls/:id</span>
                <span className="text-muted-foreground">Retrieve call status, elapsed duration, audio state & settled cost</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-amber-600 dark:text-amber-400">POST /api/v1/calls/:id/cancel</span>
                <span className="text-muted-foreground">Cancel pending task and immediately release atomic credit hold</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">GET /api/v1/balance</span>
                <span className="text-muted-foreground">Fetch available credits, active balance holds & settlement history</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">GET /api/v1/rates?to=+1...</span>
                <span className="text-muted-foreground">Calculate real-time per-minute rate and estimate call hold value</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">POST /api/v1/webhooks</span>
                <span className="text-muted-foreground">Register webhook URL with HMAC-SHA256 signature verification</span>
              </div>
            </div>
          </section>

          {/* Safety & Compliance */}
          <section className="border border-border bg-[#F8F9FA] dark:bg-[#16161B] p-6">
            <div className="flex items-center justify-between border-b-2 border-dashed border-border pb-3 mb-4">
              <h3 className="mono text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#8B6B55] dark:text-[#C9A690]" /> Legal Compliance & Safeguards
              </h3>
              <span className="mono text-[10px] text-muted-foreground">AUDITED</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 text-xs font-light">
              <div>
                <h4 className="mono font-semibold uppercase text-foreground mb-1">Consent Attestation</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Every API request must supply <code>consent_attestation: true</code> certifying compliance with applicable calling laws (TCPA, TSR, GDPR).
                </p>
              </div>
              <div>
                <h4 className="mono font-semibold uppercase text-foreground mb-1">Emergency & Premium Denylist</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Calls to emergency responders (911, 112, 999) and premium extortion numbers (1-900, +881) are strictly blocked at the routing layer.
                </p>
              </div>
              <div>
                <h4 className="mono font-semibold uppercase text-foreground mb-1">Atomic Holds & Settlement</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Postgres row-level locks hold credits prior to placement and settle the exact penny upon hangup, preventing accidental overdraws.
                </p>
              </div>
              <div>
                <h4 className="mono font-semibold uppercase text-foreground mb-1">Zero Audio Retention</h4>
                <p className="text-muted-foreground leading-relaxed">
                  We maintain strict two-party privacy by never recording or archiving audio streams across any carrier interconnects.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
