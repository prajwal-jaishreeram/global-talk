import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - Ringlink" },
      { name: "description", content: "How Ringlink collects, uses, and protects your data." },
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
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>We collect information that you provide directly to us, including:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Account information (email, password)</li>
            <li>Phone numbers and call history</li>
            <li>Payment and billing information</li>
            <li>Usage data and interaction with our services</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p>We use the collected information to:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Provide phone and calling services</li>
            <li>Process payments and maintain billing records</li>
            <li>Improve call quality and service reliability</li>
            <li>Ensure security and prevent fraud</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share your information with:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Telecommunications providers to complete calls</li>
            <li>Payment processors for billing purposes</li>
            <li>Law enforcement when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Call Data</h2>
          <p>
            We maintain records of calls made through our service, including phone numbers, duration, and timestamps. This data is encrypted and stored securely. We retain call records only as long as necessary for billing and legal compliance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Access your call history and account data</li>
            <li>Request deletion of your call records</li>
            <li>Correct your account information</li>
            <li>Export your data in a portable format</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p className="mt-2">Email: <a href="mailto:info@ringlink.app" className="text-primary hover:underline">info@ringlink.app</a></p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and sending an email notification to active users.
          </p>
        </section>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
