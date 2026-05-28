import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy - Eginta" },
      {
        name: "description",
        content: "Refund, cancellation, and failed-call credit policy for Eginta.",
      },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 28, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Overview</h2>
            <p>
              This Refund Policy explains when Eginta provides refunds, replacement credits, or
              cancellations for prepaid calling credits, failed calls, auto top-up charges, and
              phone number purchases. Eginta is a digital calling service, so there are no physical
              goods to return and no shipping charges.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Refund Window</h2>
            <p>
              You may request a refund for unused prepaid credits within 14 days of the original
              purchase date. Refund requests received after 14 days may be denied unless required by
              applicable law or approved by Eginta because of a verified service issue.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              3. Eligible Refunds and Credits
            </h2>
            <p>We may approve a refund or replacement credit when:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Credits are unused and the request is made within the 14-day refund window.</li>
              <li>
                A duplicate payment, accidental duplicate top-up, or incorrect charge is verified.
              </li>
              <li>
                A payment is captured but the related credits or phone number are not delivered.
              </li>
              <li>A call fails because of a verified Eginta, carrier, or routing error.</li>
              <li>Applicable law requires a refund.</li>
            </ul>
            <p className="mt-2">
              For failed or poor-quality calls, we may provide make-up credits instead of a cash
              refund when credits fairly resolve the issue.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Non-Refundable Cases</h2>
            <p>Refunds may be denied for:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Credits already used for successfully connected calls.</li>
              <li>Requests made after the refund window without a verified service issue.</li>
              <li>
                Accounts suspended for fraud, illegal activity, spam, mass calling, abuse, or Terms
                violations.
              </li>
              <li>
                Costs already incurred for active phone numbers, carrier charges, or regulatory fees
                unless the provider failed to provision the service.
              </li>
              <li>
                Problems caused by unsupported devices, blocked microphones, poor internet, or
                user-side network issues.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Auto Top-Up Cancellations</h2>
            <p>
              You can disable auto top-up from your billing settings before a future charge is
              created. If an auto top-up was charged by mistake or did not add credits correctly,
              contact support within 14 days so we can review the transaction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Phone Number Purchases</h2>
            <p>
              If payment is captured but a phone number cannot be provisioned, we will help you
              retry provisioning, choose another available number, or refund the affected payment.
              Once a number is successfully provisioned and active, charges for that number may be
              non-refundable unless required by law or caused by a verified provider failure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. How to Request a Refund</h2>
            <p>
              Email{" "}
              <a href="mailto:support@eginta.com" className="text-primary hover:underline">
                support@eginta.com
              </a>{" "}
              or use our{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact
              </Link>{" "}
              page. Include your account email, payment date, amount, transaction ID if available,
              and a short description of the issue. For call-quality issues, include the call time,
              destination number, and what went wrong.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Processing Time and Fees</h2>
            <p>
              We review refund requests within one business day where possible. Approved refunds are
              submitted to the original payment method within 5 to 7 business days. Your bank, card
              issuer, wallet, or payment processor may take additional time to post the refund.
              Eginta does not charge a refund fee, but payment processors or banks may apply their
              own rules.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Chargebacks</h2>
            <p>
              Please contact us before filing a chargeback so we can investigate and resolve the
              issue quickly. Chargebacks may delay account review, refunds, or service restoration
              while the payment provider investigates the dispute.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Related Policies</h2>
            <p>
              This policy should be read with our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
