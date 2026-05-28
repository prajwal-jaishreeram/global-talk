import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - Eginta" },
      { name: "description", content: "How Eginta collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 28, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p>We collect information needed to provide, secure, bill, and support Eginta:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>
                Account information, such as email address, login credentials, and profile data.
              </li>
              <li>Contact and support information you send to us.</li>
              <li>
                Calling information, such as phone numbers dialed, timestamps, duration, status,
                rates, and billing metadata.
              </li>
              <li>
                Payment records, such as purchase amount, currency, transaction IDs, refund status,
                and billing history.
              </li>
              <li>
                Device and usage information, such as browser, IP address, approximate location,
                logs, diagnostics, and security events.
              </li>
            </ul>
            <p className="mt-2">
              Eginta does not store full card numbers. Card and wallet payments are handled by our
              payment processors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Information</h2>
            <p>We use information to:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Create and secure your account.</li>
              <li>Connect calls, calculate rates, deduct credits, and show call history.</li>
              <li>Process payments, refunds, chargebacks, tax records, and fraud checks.</li>
              <li>Provide customer support and respond to billing or service questions.</li>
              <li>
                Monitor reliability, troubleshoot issues, prevent abuse, and improve the service.
              </li>
              <li>
                Comply with law, telecom rules, payment-provider requirements, and lawful requests.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              3. Call Audio and Call Metadata
            </h2>
            <p>
              We do not record or store call audio as part of normal calling service. We do store
              call metadata, including numbers, time, duration, destination, rate, and status, so we
              can provide call history, billing, support, fraud prevention, and compliance records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. How We Share Information</h2>
            <p>
              We do not sell your personal information. We share information only as needed with:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>
                Telecommunications providers and carriers that route calls or provision numbers.
              </li>
              <li>
                Payment processors and merchant-of-record providers that process transactions.
              </li>
              <li>Hosting, database, analytics, email, security, and support vendors.</li>
              <li>Regulators, law enforcement, courts, or other parties when required by law.</li>
              <li>
                Professional advisors or successors in connection with audits, compliance, or a
                business transfer.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              5. Cookies and Similar Technologies
            </h2>
            <p>
              We may use cookies, local storage, and similar technologies to keep you signed in,
              remember settings, protect the service, measure usage, and improve reliability. You
              can control cookies through your browser settings, but some account features may not
              work correctly if required cookies are blocked.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>
              We keep account, call, billing, payment, support, and security records for as long as
              needed to provide the service, resolve disputes, prevent fraud, meet legal and telecom
              obligations, and maintain accurate financial records. When information is no longer
              needed, we delete it or de-identify it where practical.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Security</h2>
            <p>
              We use technical and organizational safeguards designed to protect personal
              information, including encrypted connections, access controls, server-side payment
              handling, and security monitoring. No online service can guarantee absolute security,
              so you should keep your account credentials private and contact us if you suspect
              unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Your Choices and Rights</h2>
            <p>Depending on your location and applicable law, you may request to:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Access or export account, billing, and call history information.</li>
              <li>Correct inaccurate account information.</li>
              <li>
                Delete certain personal information, subject to billing, fraud, telecom, and legal
                retention requirements.
              </li>
              <li>Object to or restrict certain processing where applicable.</li>
            </ul>
            <p className="mt-2">
              To make a request, email{" "}
              <a href="mailto:support@eginta.com" className="text-primary hover:underline">
                support@eginta.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Children</h2>
            <p>
              Eginta is not intended for children under 13, and we do not knowingly collect personal
              information from children under 13. If you believe a child has provided personal
              information to us, contact us so we can review and delete it where required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy as our service, vendors, legal obligations, or
              security practices change. Updates will be posted on this page with a new last updated
              date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p>
              For privacy questions or requests, contact Eginta at{" "}
              <a href="mailto:support@eginta.com" className="text-primary hover:underline">
                support@eginta.com
              </a>{" "}
              or visit our{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact
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
