import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions - Ringringa" },
      { name: "description", content: "The terms that govern your use of Ringringa." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 28, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Agreement to These Terms</h2>
            <p>
              These Terms and Conditions govern your access to and use of Ringringa, including our
              browser-based calling service, calling credits, phone number features, account tools,
              and related support. By creating an account, buying credits, purchasing a phone
              number, enabling auto top-up, or using Ringringa, you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Service Description</h2>
            <p>
              Ringringa provides internet-based voice calling and related telecom tools. Calls are
              routed through third-party telecommunications providers, and call availability,
              quality, rates, and supported destinations may vary by carrier, country, network
              conditions, regulation, and destination number.
            </p>
            <p className="mt-2">
              Ringringa is a digital service. We do not ship physical goods. Account access, credits,
              call features, and any purchased phone number functionality are delivered online after
              payment confirmation and any required provider checks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Accounts and Eligibility</h2>
            <p>
              You are responsible for keeping your login credentials secure and for all activity on
              your account. You must provide accurate information and keep your contact and billing
              details current. We may ask for additional information before enabling certain phone
              number, business, compliance, or high-risk calling features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
            <p>You agree not to use Ringringa for:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Illegal activity, fraud, scams, impersonation, harassment, or abuse.</li>
              <li>Spam, robocalling, mass calling, or traffic that violates telecom rules.</li>
              <li>Emergency calls or any use where uninterrupted access is required.</li>
              <li>Interfering with the service, carriers, payment systems, or other users.</li>
            </ul>
            <p className="mt-2">
              We may suspend, limit, or close accounts and withhold service where we reasonably
              believe these Terms, applicable laws, carrier rules, or payment-provider rules have
              been violated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              5. Pricing, Credits, and Billing
            </h2>
            <p>
              Calling is billed from your prepaid credit balance based on the rate displayed in the
              app or on our{" "}
              <Link to="/rates" className="text-primary hover:underline">
                Rates
              </Link>{" "}
              page. Rates may change because of carrier costs, destination changes, taxes, currency
              changes, or regulatory costs. We aim to show applicable pricing before you place a
              call or complete a purchase.
            </p>
            <p className="mt-2">
              Credits are digital account credits for Ringringa services. Credits do not earn interest,
              cannot be transferred outside Ringringa, and are not redeemable for cash except where our
              Refund Policy or applicable law requires a refund.
            </p>
            <p className="mt-2">
              If you enable auto top-up, you authorize us and our payment processors to charge your
              saved payment method when your balance reaches the threshold you selected. You can
              disable auto top-up from your billing settings before a future charge is created.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Phone Numbers</h2>
            <p>
              If Ringringa offers phone number purchase, rental, or inbound calling features, numbers
              remain subject to carrier availability, regional rules, documentation requirements,
              and provider approval. A number is not guaranteed until payment is verified and the
              provider confirms provisioning. Releasing a number may be permanent and may stop
              future access to that number.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              7. Call Quality and Availability
            </h2>
            <p>
              We work to provide reliable call service, but internet connectivity, browser support,
              carrier routing, destination networks, local regulation, and device settings can
              affect call completion and audio quality. We do not guarantee that the service will be
              uninterrupted, error-free, or available in every destination at all times.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Emergency Calls</h2>
            <p>
              Ringringa is not a replacement for a traditional phone line and must not be used for
              emergency calls. We cannot guarantee access to emergency services, accurate location
              routing, or uninterrupted emergency connectivity. Use a traditional phone service for
              emergencies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Refunds and Cancellations</h2>
            <p>
              Refund eligibility, failed-call credits, duplicate payment handling, and cancellation
              timelines are described in our{" "}
              <Link to="/refund" className="text-primary hover:underline">
                Refund Policy
              </Link>
              . By purchasing credits or other services, you agree to that policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Privacy</h2>
            <p>
              Our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              explains what information we collect, how we use it, how we share it with service
              providers, and how you can contact us about privacy requests. We do not record or
              store call audio as part of normal calling service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Ringringa is not liable for indirect, incidental,
              special, consequential, or punitive damages, loss of profits, loss of data, missed
              calls, carrier failures, destination blocking, or losses caused by your misuse of the
              service. Our total liability for a claim is limited to the amount you paid to Ringringa
              for the affected service in the 30 days before the claim, except where law requires a
              different limit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Changes to These Terms</h2>
            <p>
              We may update these Terms when our service, pricing, providers, regulations, or
              business requirements change. Updates will be posted on this page with a new last
              updated date. Continued use of Ringringa after an update means you accept the updated
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Contact</h2>
            <p>
              For questions about these Terms, billing, refunds, or service access, contact Ringringa
              support at{" "}
              <a href="mailto:prajwalshindeee@gmail.com" className="text-primary hover:underline">
                prajwalshindeee@gmail.com
              </a>{" "}
              or use our{" "}
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
