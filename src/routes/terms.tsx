import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Ringringa AI Telephony Protocol" },
      {
        name: "description",
        content:
          "Terms and conditions governing the Ringringa AI agent telephony protocol, API, dialer infrastructure, and prepaid micro-settlements.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="border-b border-border pb-8">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">
            Protocol Governance &amp; Developer Terms
          </div>
          <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Effective Date: May 28, 2026 · Version 2.4 (Autonomous Agent Telephony Pivot)
          </p>
        </div>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              1. Agreement to Terms &amp; Scope of Service
            </h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you
              (whether as an individual developer, organization, or software agent operator,
              hereinafter "Developer" or "User") and Ringringa ("Ringringa," "we," "us," or "our").
            </p>
            <p>
              Ringringa provides an autonomous AI agent telephony infrastructure, programmable voice
              API, operator WebRTC dialer, virtual number provisioning, and prepaid per-second
              micro-settlement protocol (collectively, the "Service" or "Protocol"). By accessing the
              API, provisioning an API key (<code className="font-mono text-foreground">rg_live_*</code>),
              purchasing prepaid credits, embedding our dialer, or transmitting dispatch payloads,
              you agree to be bound unconditionally by these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              2. Autonomous Agent Calling &amp; Mandatory Consent Attestation
            </h2>
            <p>
              Ringringa is purpose-built for legitimate autonomous AI agent workflows (e.g., customer
              service dispatch, booking confirmations, logistics verification, and interactive voice
              agents). Because our infrastructure enables programmable call dispatch, you agree to
              the following non-negotiable compliance rules:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Mandatory Consent Attestation:</strong> Every
                automated dispatch payload passed to the Ringringa API must include an explicit
                attestation (<code className="font-mono text-foreground">consent_attestation: true</code>
                ) verifying that you hold verified prior express consent or an established business
                relationship with the target party.
              </li>
              <li>
                <strong className="text-foreground">Anti-Spam &amp; Anti-Robocall Compliance:</strong>{" "}
                You strictly agree to comply with all applicable local, national, and international
                telemarketing, anti-spam, and privacy regulations, including the US Telephone Consumer
                Protection Act (TCPA), FCC STIR/SHAKEN standards, the European Union General Data
                Protection Regulation (GDPR) and ePrivacy Directive, and the Telecom Regulatory
                Authority of India (TRAI) regulations.
              </li>
              <li>
                <strong className="text-foreground">Prohibition of Voice Cloning Fraud:</strong> You
                shall not utilize Ringringa to generate synthetic voice scams, impersonate public
                officials, banks, or emergency authorities, or conduct fraudulent phishing
                ("vishing") campaigns.
              </li>
              <li>
                <strong className="text-foreground">Calling Hours Enforcement:</strong> Programmatic
                agent calls to consumers must adhere to legal local calling time windows (e.g.,
                between 8:00 AM and 9:00 PM local time of the recipient).
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              3. Strict Emergency Services Denylist
            </h2>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
              <strong>CRITICAL NOTICE:</strong> Ringringa is an IP-based voice trunking and agent API
              service. It is NEVER a replacement for traditional wireline or wireless emergency
              telephony.
            </div>
            <p>
              Our SIP trunks strictly block and refuse dispatch to emergency services numbers worldwide,
              including but not limited to <strong>911</strong> (US/Canada), <strong>112</strong> (EU/UK),
              <strong> 999</strong> (UK), <strong>000</strong> (Australia), and <strong>100/112</strong>
              (India). You must never configure autonomous agents to contact emergency responder lines,
              crisis hotlines, or critical infrastructure emergency systems.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              4. Zero Voice Audio Recording Guarantee
            </h2>
            <p>
              Ringringa operates with a fundamental zero-knowledge privacy architecture for voice
              audio streams:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                All live call audio is routed via encrypted WebRTC and TLS/SRTP SIP media trunks directly
                through telecommunications carrier interconnects.
              </li>
              <li>
                Ringringa <strong>does not record, tap, save, transcribe, or retain audio stream payloads</strong>
                on our servers.
              </li>
              <li>
                We never feed customer audio or conversational voice data into foundational AI training
                datasets.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              5. API Keys, Security &amp; Rate Limits
            </h2>
            <p>
              Access to the Ringringa Agent Dispatch API requires authenticated API tokens:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <code className="font-mono text-foreground">rg_live_*</code> keys initiate actual carrier
                SIP trunks and incur micro-settlement deductions against your balance.
              </li>
              <li>
                <code className="font-mono text-foreground">rg_test_*</code> keys operate in a sandboxed
                environment simulating carrier states without placing live PSTN calls.
              </li>
            </ul>
            <p>
              You are entirely responsible for securing your API keys. Any call originated with your API
              key is deemed authorized by you. Ringringa implements rate limits (e.g., maximum concurrent
              call trunks and calls-per-minute caps) to protect downstream carrier networks against
              runaway loops.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              6. Prepaid Balances, Per-Second Settlement &amp; Billing
            </h2>
            <p>
              Ringringa operates on an atomic prepaid micro-settlement model:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">Atomic Micro-Billing:</strong> Calls are billed on an
                exact per-second basis rounded to six decimal places, calculated using the transparent
                destination rate card displayed on our{" "}
                <Link to="/rates" className="text-primary hover:underline">
                  Rates
                </Link>{" "}
                page.
              </li>
              <li>
                <strong className="text-foreground">Prepaid Balances:</strong> Usage is decremented
                in real-time from your prepaid balance. If your balance reaches $0.00, active calls will
                be terminated gracefully and subsequent API requests will receive a{" "}
                <code className="font-mono text-foreground">402 Payment Required</code> response.
              </li>
              <li>
                <strong className="text-foreground">Merchant of Record:</strong> Payment processing and
                invoicing are securely managed via our merchant of record partner, Polar, with support
                for cards, Apple Pay, Google Pay, and automatic balance top-ups.
              </li>
              <li>
                <strong className="text-foreground">Auto Top-Up:</strong> If you configure auto top-up,
                you authorize automated credit card charges when your balance drops below your specified
                trigger threshold. You may disable this at any time in your{" "}
                <Link to="/dashboard/settings" className="text-primary hover:underline">
                  Settings
                </Link>
                .
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              7. Virtual Numbers &amp; Caller ID Verification
            </h2>
            <p>
              Virtual phone numbers purchased via Ringringa are provisioned through licensed Tier-1
              telecommunications carriers (such as Telnyx). Numbers remain active provided monthly lease
              fees are covered by your balance. Carrier regulations may require submission of
              identity verification (Know Your Customer / KYC) or business registration documents for
              specific country prefixes.
            </p>
            <p>
              Custom outbound caller ID spoofing is strictly prohibited. You may only present outbound
              caller IDs that have completed our automated two-step SMS or voice verification challenge.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              8. Suspension &amp; Abuse Termination
            </h2>
            <p>
              Ringringa reserves the absolute right to instantly revoke API keys, terminate active call
              trunks, and suspend accounts without prior notice if we detect:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>High carrier dispute or spam-complaint rates (&gt;0.1% answer threshold).</li>
              <li>Unattested automated robodialing loops or brute-force sequential dialing.</li>
              <li>Telephony fraud, toll fraud, or unauthorized artificial traffic inflation (AIT).</li>
              <li>Failure to provide required regulatory KYC documentation upon carrier request.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              9. Disclaimer of Warranties &amp; Limitation of Liability
            </h2>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. RINGRINGA AND ITS CARRIER
              PARTNERS EXPRESSLY DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
              INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT.
            </p>
            <p>
              IN NO EVENT SHALL RINGRINGA BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, INCLUDING LOSS OF REVENUE, LOST AGENT OPPORTUNITY, MISSED CALLS, OR
              CARRIER DROPS. OUR AGGREGATE LIABILITY ARISING OUT OF THESE TERMS SHALL NOT EXCEED THE TOTAL
              FEES PAID BY YOU TO RINGRINGA IN THE THIRTY (30) DAYS PRECEDING THE CLAIM.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              10. Governing Law &amp; Contact
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              applicable jurisdiction, without regard to conflict of law principles.
            </p>
            <p>
              For legal compliance inquiries, enterprise volume contracts, or custom rate inquiries,
              contact our infrastructure team at{" "}
              <a href="mailto:prajwalshindeee@gmail.com" className="text-primary hover:underline">
                prajwalshindeee@gmail.com
              </a>{" "}
              or via our{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact &amp; Transmissions
              </Link>{" "}
              page.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
