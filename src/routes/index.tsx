import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  Bot,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Phone,
  Sparkles,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuthState } from "@/lib/auth-client";
import { AgentCallLaptopDemo } from "@/components/mockups/agent-call-laptop-demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgentCall — Give Your AI Agent a Phone" },
      {
        name: "description",
        content:
          "API, MCP server, and CLI for AI agents to place phone calls. Human-in-the-loop browser dialer. Transparent prepaid rates, zero seat fees.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash]);

  return (
    <div className="min-h-screen bg-white text-[#1C1C1B] dark:bg-[#0D0D11] dark:text-[#F3F3F5] font-sans antialiased selection:bg-foreground selection:text-background flex flex-col transition-colors">
      <SiteHeader />
      <HeroSection />
      <AgentSetupCommandSection />
      <LaptopDemoSection />
      <ProtocolWorkflowSection />
      <PricingAndRatesSection />
      <ComplianceAndSafetySection />
      <SiteFooter />
    </div>
  );
}

function HeroSection() {
  const { ready, isAuthenticated } = useAuthState();

  return (
    <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center max-w-4xl mx-auto">
      <div className="mono text-[11px] mb-6 text-[#8B6B55] dark:text-[#C9A690] font-bold uppercase tracking-widest inline-flex items-center gap-2 border border-[#8B6B55]/30 bg-[#8B6B55]/10 px-3 py-1 rounded-full">
        <span>◆</span> AGENTIC TELEPHONY · HUMAN-IN-THE-LOOP
      </div>

      <h1 className="serif text-6xl sm:text-7xl md:text-8xl leading-[0.88] mb-8 font-light text-foreground">
        Give your AI agent<br />
        <span className="italic text-[#2A382E] dark:text-[#88C090]">a phone</span>.
      </h1>

      <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 text-muted-foreground font-light leading-relaxed">
        Autonomous agents can research and write, but they cannot dial phone numbers.
        AgentCall gives Claude, ChatGPT, n8n, and custom agents an API, an MCP server, and a CLI.
        The agent queues the call; your team picks up and talks in the browser.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
        <Link
          to={ready && isAuthenticated ? "/dashboard" : "/auth/signup"}
          className="w-full sm:w-auto bg-foreground text-background px-8 py-4 mono text-xs font-semibold hover:opacity-90 transition-all text-center tracking-wider"
        >
          {ready && isAuthenticated ? "ENTER DIALER" : "GET API KEY"}
        </Link>
        <Link
          to="/docs"
          className="w-full sm:w-auto border border-foreground text-foreground px-8 py-4 mono text-xs font-semibold hover:bg-foreground hover:text-background transition-all text-center tracking-wider"
        >
          VIEW PROTOCOL
        </Link>
      </div>
    </section>
  );
}

function AgentSetupCommandSection() {
  const [copied, setCopied] = useState(false);

  const setupPrompt = `You are integrated with AgentCall calling API.
Your goal is to place phone calls through AgentCall.

Base URL: https://agentcall.org/api/v1
Docs: https://agentcall.org/llms.txt
OpenAPI: https://agentcall.org/openapi.yaml

To queue a call, POST https://agentcall.org/api/v1/calls
Headers:
  Authorization: Bearer <YOUR_API_KEY>
  Content-Type: application/json
Body JSON:
{
  "to": "+14155552671",
  "goal": "Introduce our AI service",
  "script": "Hi, this is calling on behalf of...",
  "notes": "Follow up on customer inquiry",
  "consent_attestation": true
}`;

  function handleCopy() {
    navigator.clipboard.writeText(setupPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="w-full max-w-3xl mx-auto px-6 py-6">
      <div className="bg-card dark:bg-[#16161B] border border-border p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-dashed border-border gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#8B6B55] dark:text-[#C9A690]" />
            <span className="mono text-xs font-bold uppercase tracking-wider text-foreground">
              Prompt: Setup In Your AI Agent
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="mono text-[11px] border border-border px-3 py-1 bg-background text-foreground hover:bg-foreground hover:text-background transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "COPIED TO CLIPBOARD" : "COPY PROMPT"}</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground font-light mb-3">
          Paste this prompt into Claude, ChatGPT, Cursor, or your autonomous agent. The agent will immediately learn the protocol and start placing calls.
        </p>

        <pre className="mono text-[11px] bg-black/5 dark:bg-white/5 p-3.5 rounded border border-border overflow-x-auto text-foreground whitespace-pre leading-relaxed select-all">
          {setupPrompt}
        </pre>
      </div>
    </section>
  );
}

function LaptopDemoSection() {
  return (
    <section className="w-full max-w-4xl mx-auto px-6 py-12 flex flex-col items-center">
      <div className="mono text-[11px] text-[#8B6B55] uppercase tracking-widest mb-3 font-semibold">
        ◆ Live Interaction Lifecycle
      </div>
      <h2 className="serif text-3xl sm:text-4xl font-light mb-8 text-center">
        From prompt to phone line.
      </h2>

      <div className="w-full flex justify-center">
        <AgentCallLaptopDemo />
      </div>
    </section>
  );
}

function ProtocolWorkflowSection() {
  const steps = [
    {
      num: "01",
      title: "Agent Decides & Queues",
      desc: "Your AI agent evaluates a lead or task, constructs speaking points, and sends a POST request with explicit consent.",
      tag: "REST / MCP / CLI",
    },
    {
      num: "02",
      title: "Browser Dialer Alerts Human",
      desc: "The call request appears live in the AgentCall browser dialer with the phone number and script already populated.",
      tag: "REALTIME WEBRTC",
    },
    {
      num: "03",
      title: "Connect & Atomic Settle",
      desc: "Human operator clicks 'Call Now' and speaks. When hung up, exact per-minute costs are atomically deducted from credits.",
      tag: "ATOMIC SETTLE",
    },
  ];

  return (
    <section id="how" className="w-full max-w-5xl mx-auto px-6 py-16 border-t border-border">
      <div className="mono text-[11px] text-[#8B6B55] dark:text-[#C9A690] uppercase tracking-widest mb-2 font-semibold">
        ◆ Operational Architecture
      </div>
      <h2 className="serif text-4xl sm:text-5xl font-light mb-12 text-foreground">
        How the protocol works.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.num} className="bg-card dark:bg-[#16161B] border border-border p-6 flex flex-col justify-between">
            <div>
              <div className="mono text-2xl font-light text-muted-foreground/50 mb-4">{s.num}</div>
              <h3 className="serif text-xl font-semibold mb-2 text-foreground">{s.title}</h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed mb-6">{s.desc}</p>
            </div>
            <div className="mono text-[10px] text-muted-foreground border-t border-border pt-3">
              {s.tag}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingAndRatesSection() {
  return (
    <section className="w-full max-w-5xl mx-auto px-6 py-16 border-t border-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="mono text-[11px] text-[#8B6B55] dark:text-[#C9A690] uppercase tracking-widest mb-2 font-semibold">
            ◆ Economics
          </div>
          <h2 className="serif text-4xl sm:text-5xl font-light mb-6 text-foreground">
            Zero seat fees.<br />
            <span className="italic text-[#2A382E] dark:text-[#88C090]">Prepaid credits</span>.
          </h2>
          <p className="text-sm text-muted-foreground font-light leading-relaxed mb-6">
            Legacy dialers charge $50–$150/user/month just to connect an API. AgentCall has no recurring seat license.
            Top up prepaid credits, let your AI agents place calls, and pay strictly for elapsed call minutes.
          </p>
          <div className="flex gap-4">
            <Link
              to="/rates"
              className="mono text-xs border border-foreground bg-foreground text-background px-6 py-3 hover:opacity-90 transition-colors"
            >
              RATE CALCULATOR
            </Link>
          </div>
        </div>

        <div className="bg-card dark:bg-[#16161B] border border-border p-6 shadow-xs">
          <div className="mono text-[11px] text-muted-foreground pb-3 mb-4 border-b border-border flex justify-between">
            <span>DESTINATION TIERS</span>
            <span>RATES (USD/MIN)</span>
          </div>

          <div className="space-y-3 mono text-xs">
            <div className="flex justify-between py-1 border-b border-dashed border-border">
              <span>United States & Canada</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">$0.020 / min</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dashed border-border">
              <span>United Kingdom & EU Landlines</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">$0.024 / min</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dashed border-border">
              <span>India Mobile</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">$0.025 / min</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dashed border-border">
              <span>Australia & Japan</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">$0.035 / min</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border mono text-[10px] text-muted-foreground text-center">
            PER-SECOND BILLING AFTER FIRST MINUTE · NO CONTRACT REQUIRED
          </div>
        </div>
      </div>
    </section>
  );
}

function ComplianceAndSafetySection() {
  return (
    <section className="w-full max-w-5xl mx-auto px-6 py-16 border-t border-border mb-8">
      <div className="mono text-[11px] text-[#8B6B55] dark:text-[#C9A690] uppercase tracking-widest mb-2 font-semibold">
        ◆ Safety & Governance
      </div>
      <h2 className="serif text-3xl sm:text-4xl font-light mb-8 text-foreground">
        Built for legal compliance.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-light">
        <div className="border border-border p-5 bg-card dark:bg-[#16161B]">
          <div className="mono font-bold text-xs mb-2 text-foreground">Consent Attestation</div>
          <p className="text-muted-foreground leading-relaxed">
            Every API call requires <code>consent_attestation: true</code>, certifying you possess lawful authority to dial the destination.
          </p>
        </div>
        <div className="border border-border p-5 bg-card dark:bg-[#16161B]">
          <div className="mono font-bold text-xs mb-2 text-foreground">Global Denylist</div>
          <p className="text-muted-foreground leading-relaxed">
            Emergency lines (911, 112) and high-fraud premium-rate prefixes are permanently blocked by database policy.
          </p>
        </div>
        <div className="border border-border p-5 bg-card dark:bg-[#16161B]">
          <div className="mono font-bold text-xs mb-2 text-foreground">Zero Audio Recordings</div>
          <p className="text-muted-foreground leading-relaxed">
            We never record phone audio. Calls travel over encrypted WebRTC and carrier trunks with absolute privacy.
          </p>
        </div>
      </div>
    </section>
  );
}
