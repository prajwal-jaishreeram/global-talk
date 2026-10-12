import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ringringa AI Telephony Protocol" },
      {
        name: "description",
        content:
          "Privacy policy explaining Ringringa's zero audio recording policy, agent task payload handling, and carrier metadata compliance.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="border-b border-border pb-8">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">
            Data Privacy &amp; Cryptographic Architecture
          </div>
          <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Effective Date: May 28, 2026 · Version 2.4 (Autonomous Agent Telephony Protocol)
          </p>
        </div>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              1. Our Privacy Commitment
            </h2>
            <p>
              Ringringa ("we," "our," or "us") provides low-latency telephony infrastructure designed
              for autonomous AI agents, automated software dispatchers, and human operators. We
              firmly believe that programmatic agent telephony must maintain rigorous privacy
              guarantees.
            </p>
            <p>
              This Privacy Policy explains what data we collect, why we collect it, how it is processed,
              and our strict limitations regarding voice audio data.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              2. Absolute Zero Voice Audio Recording Policy
            </h2>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground">
              <strong className="block mb-1 text-sm font-medium">Zero-Knowledge Voice Streams:</strong>
              Ringringa does NOT record, tap, store, transcribe, or retain live voice audio from your calls.
            </div>
            <p>
              When an agent or browser operator initiates a call:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                Media streams are negotiated over WebRTC (DTLS-SRTP encryption) and piped directly to
                licensed Tier-1 carrier SIP trunks.
              </li>
              <li>
                Voice audio packets flow ephemerally through memory and are never persisted to disk,
                storage buckets, or third-party databases.
              </li>
              <li>
                <strong>No AI Model Training:</strong> Your call audio, conversation transcripts, and
                agent vocal responses are NEVER used to train, tune, or refine foundational speech,
                transcription, or language models.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              3. Information We Collect &amp; Process
            </h2>
            <p>
              To maintain carrier connectivity, enforce carrier compliance rules, calculate per-second
              micro-settlements, and provide developer tools, we collect:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Authentication &amp; Account Identifiers:</strong>{" "}
                Your verified email address, encrypted authentication hashes, user ID, and API key
                fingerprints (<code className="font-mono text-foreground">rg_live_*</code>,{" "}
                <code className="font-mono text-foreground">rg_test_*</code>).
              </li>
              <li>
                <strong className="text-foreground">Call Detail Records (CDR Metadata):</strong>{" "}
                Destination telephone numbers (E.164), caller ID presented, start time, termination
                time, duration in seconds, carrier SIP status codes (e.g., answered, busy, failed),
                destination ISO country code, and calculated per-second settlement charge.
              </li>
              <li>
                <strong className="text-foreground">Agent Task &amp; Dispatch Payloads:</strong> When
                agents dispatch calls programmatically, optional developer-provided metadata (such as
                agent objective tags, reference task IDs, or operator notes) are stored in your
                isolated account partition protected by Supabase Row-Level Security (RLS).
              </li>
              <li>
                <strong className="text-foreground">Payment &amp; Micro-Settlement History:</strong>{" "}
                Prepaid credit balance transactions, transaction timestamps, and payment tokens. We do
                NOT collect or store raw credit card numbers; payment tokenization is handled via PCI-DSS
                compliant merchant of record systems (Polar).
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              4. How We Use Your Data
            </h2>
            <p>Your data is used strictly for the following operational purposes:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                Routing calls over international PSTN telephony interconnects to the intended destination.
              </li>
              <li>
                Executing atomic micro-billing deductions from your prepaid credit balance.
              </li>
              <li>
                Providing historical call records and billing analytics within your private dashboard.
              </li>
              <li>
                Preventing spam, fraudulent traffic inflation (AIT), robocall storms, and non-compliant
                unattested agent operations.
              </li>
              <li>
                Complying with mandatory telecom regulations, including STIR/SHAKEN, TCPA, and TRAI
                traceback requirements.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              5. Third-Party Infrastructure &amp; Carriers
            </h2>
            <p>
              We partner with trusted enterprise infrastructure providers to deliver high-availability
              telecom services:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Telephony Trunks (Telnyx LLC):</strong> Operates
                the global private IP network connecting WebRTC gateways to national PSTN carrier lines.
                Telnyx receives destination telephone numbers and routing instructions to terminate calls.
              </li>
              <li>
                <strong className="text-foreground">Merchant of Record (Polar Sh.):</strong> Handles
                credit card billing, global sales tax and VAT compliance, and payment disputes.
              </li>
              <li>
                <strong className="text-foreground">Cloud Database (Supabase / AWS):</strong> Houses
                encrypted account credentials and Call Detail Records with strict tenant isolation.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              6. Data Retention &amp; Deletion
            </h2>
            <p>
              We maintain call metadata and CDR logs for billing reconciliation, carrier audit
              disputes, and tax accounting compliance for up to 24 months. You can delete individual
              contacts, notes, and virtual phone numbers at any time directly through the dashboard.
            </p>
            <p>
              To request a complete account deletion or data export under GDPR, CCPA, or applicable
              data protection statutes, email our data team at{" "}
              <a href="mailto:prajwalshindeee@gmail.com" className="text-primary hover:underline">
                prajwalshindeee@gmail.com
              </a>
              .
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              7. Security Architecture
            </h2>
            <p>
              We implement industry-standard protective measures:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>End-to-end encrypted transport (HTTPS / TLS 1.3) for all web and API traffic.</li>
              <li>DTLS and SRTP encryption for all real-time voice media sessions.</li>
              <li>Row-Level Security (RLS) guaranteeing strict multi-tenant database isolation.</li>
              <li>Hashed API token verification preventing plaintext key extraction.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              8. Contact Our Privacy Officer
            </h2>
            <p>
              For questions regarding our zero voice recording architecture, GDPR data inquiries, or
              carrier traceback cooperation, please contact:
            </p>
            <div className="rounded-xl border border-border bg-card p-4 font-mono text-xs text-muted-foreground">
              <div>Ringringa Privacy &amp; Telecom Compliance</div>
              <div>Direct Email: <a href="mailto:prajwalshindeee@gmail.com" className="text-primary hover:underline">prajwalshindeee@gmail.com</a></div>
              <div>Response Latency: Under 12 hours on business days</div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
