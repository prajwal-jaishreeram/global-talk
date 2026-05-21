import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions - Ringlink" },
      { name: "description", content: "The terms that govern your use of Ringlink." },
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
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By using our phone service, you accept and agree to be bound by the terms and conditions outlined here. These terms govern your use of our voice calling features.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Service Usage</h2>
          <p>
            Our service allows you to make voice calls worldwide. You agree to use the service only for lawful purposes and in accordance with all applicable laws and regulations. We reserve the right to suspend service for any misuse or violation of these terms.
          </p>
          <p className="mt-2">
            Users are strictly prohibited from using the platform for illegal activities, scams, or mass calling operations. Any such activity will result in immediate account suspension and forfeiture of remaining credits.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Call Credits and Billing</h2>
          <p>
            Calls are charged based on our published rates. Credits must be purchased in advance to make calls. We reserve the right to modify our rates with notice. Unused credits are non-refundable unless required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Call Quality and Availability</h2>
          <p>
            While we strive to provide high-quality voice service, call quality depends on various factors including internet connection. We do not guarantee uninterrupted service and are not liable for service interruptions or call quality issues beyond our control.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Privacy and Call Data</h2>
          <p>
            We collect and store call metadata as required for billing and service improvement. Call content is not recorded or stored. Your use of our service is governed by our Privacy Policy, which you should review to understand our practices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Emergency Calls</h2>
          <p>
            Our service is not a replacement for traditional phone service and should not be used for emergency calls. We cannot guarantee reliable access to emergency services. Please use a traditional phone line for emergency calls.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Refund Policy</h2>
          <p>
            We offer a 100% money-back guarantee with no questions asked for customers who are not satisfied with our service.
          </p>
          <p className="mt-2">
            To request a refund, please contact our support team at <a href="mailto:support@ringlink.app" className="text-primary hover:underline">support@ringlink.app</a>. Refund requests will be processed within 5-7 business days.
          </p>
          <p className="mt-2">
            Please note that refund requests may be denied if a substantial portion of the credit package has been consumed without raising a complaint about service quality or functionality issues.
          </p>
          <p className="mt-2">
            Users who have violated our terms and conditions, including but not limited to engaging in illegal activities, scams, or mass calling operations, are not eligible for refunds under any circumstances.
          </p>
          <p className="mt-2">
            We also provide make-up credits for calls that don't work as expected. Our goal is to ensure you receive the service quality you expect, and we stand behind our commitment to customer satisfaction.
          </p>
          <p className="mt-2">
            Refunds are available for the users that have not spent any credits. The only exception are credits that were spent on a call resulting in an error.
          </p>
          <p className="mt-2">Refund requests are accepted within 2 weeks of the purchase.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
          <p>
            If you have any questions about these terms or our service, please contact us at <a href="mailto:support@ringlink.app" className="text-primary hover:underline">support@ringlink.app</a>.
          </p>
        </section>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
