import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Key, Phone, Webhook, Code, Bot, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [{ title: "API Documentation - Ringringa" }] }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
          <Bot className="h-3.5 w-3.5" /> For AI Agents & Developers
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ringringa Agent API</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Give your AI agent a phone. Trigger phone calls from Claude, ChatGPT, n8n, Make, or custom bots, connected to your human team in the browser.
        </p>
      </div>

      <div className="space-y-12">
        {/* Quickstart */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm text-primary">1</span>
            5-Minute Quickstart
          </h2>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Bot className="h-4 w-4" />
              <span>Give Your AI Agent a Phone (Auto Setup)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Want your AI agent (Claude, ChatGPT, Cursor, n8n, Make) to configure itself? Copy the prompt below into your agent:
            </p>
            <div className="rounded-lg border border-border bg-background/80 p-3 font-mono text-xs overflow-x-auto select-all">
              <pre>{`You are integrated with Ringringa calling API.
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
}`}</pre>
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm text-primary">2</span>
            Authentication
          </h2>
          <p className="text-sm text-muted-foreground">
            Include your API key as a Bearer token in the <code>Authorization</code> header.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm mb-1 text-green-500">Live Keys (rg_live_)</h3>
              <p className="text-xs text-muted-foreground">
                Dials real phone numbers worldwide using your prepaid credits.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm mb-1 text-blue-500">Test Keys (rg_test_)</h3>
              <p className="text-xs text-muted-foreground">
                Safe sandbox mode. Simulates full call lifecycles and webhooks without charging or dialing out.
              </p>
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm text-primary">3</span>
            Endpoints Summary
          </h2>

          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden text-sm">
            <div className="p-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-green-600">POST /api/v1/calls</span>
              <span className="text-xs text-muted-foreground">Create a call task for your human team</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-blue-600">GET /api/v1/calls/:id</span>
              <span className="text-xs text-muted-foreground">Check call status, duration & cost</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-amber-600">POST /api/v1/calls/:id/cancel</span>
              <span className="text-xs text-muted-foreground">Cancel a pending call & release balance hold</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-blue-600">GET /api/v1/balance</span>
              <span className="text-xs text-muted-foreground">Check remaining prepaid credit balance</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-blue-600">GET /api/v1/rates?to=+...</span>
              <span className="text-xs text-muted-foreground">Estimate per-minute calling cost</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-green-600">POST /api/v1/webhooks</span>
              <span className="text-xs text-muted-foreground">Register webhook for real-time notifications</span>
            </div>
          </div>
        </section>

        {/* Safety & Compliance */}
        <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-6">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Safety & Legal Compliance
          </h3>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
            <li><strong>Consent Attestation:</strong> Every call requires <code>consent_attestation: true</code>, certifying you have a lawful basis to contact the recipient.</li>
            <li><strong>Emergency & Denylist Filtering:</strong> Emergency lines (911, 112) and premium-rate scam prefixes (1-900, +881 satellite) are blocked globally.</li>
            <li><strong>Prepaid Holds:</strong> We hold the estimated cost before queuing and settle the exact penny when the call concludes, preventing accidental overdrafts.</li>
            <li><strong>No Call Recording:</strong> Ringringa never records phone audio, maintaining user privacy and strict two-party consent compliance.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
