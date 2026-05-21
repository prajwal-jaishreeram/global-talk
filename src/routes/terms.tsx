import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service - Ringlink" },
      { name: "description", content: "The terms that govern your use of Ringlink." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back home</Link>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>
      <div className="prose prose-invert mt-10 space-y-6 text-sm leading-7 text-muted-foreground">
        <p>Welcome to Ringlink. By creating an account or making a call, you agree to these terms.</p>
        <h2 className="text-lg font-semibold text-foreground">1. Acceptable use</h2>
        <p>You may not use Ringlink to harass, defraud, or place calls prohibited by your local laws. Premium-rate, robo-dial, and fraudulent number ranges are blocked at the carrier level.</p>
        <h2 className="text-lg font-semibold text-foreground">2. Billing</h2>
        <p>All calls are billed per second from your prepaid credit balance. Credits are non-transferable and refundable within 30 days of purchase if unused.</p>
        <h2 className="text-lg font-semibold text-foreground">3. Service availability</h2>
        <p>We target 99.9% uptime but make no guarantee. Emergency services (911, 112, 999, 100) are not supported - keep a real phone for emergencies.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Termination</h2>
        <p>You can close your account at any time from Settings. We may suspend accounts that violate these terms.</p>
        <h2 className="text-lg font-semibold text-foreground">5. Contact</h2>
        <p>Questions? Email support@ringlink.app.</p>
      </div>
    </div>
  );
}