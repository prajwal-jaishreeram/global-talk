import { createFileRoute, Link } from "@tanstack/react-router";

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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back home</Link>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>
      <div className="prose prose-invert mt-10 space-y-6 text-sm leading-7 text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
        <p>Account email, profile name, call metadata (numbers dialed, duration, cost, timestamps) and billing records. We do <strong>not</strong> record call audio.</p>
        <h2 className="text-lg font-semibold text-foreground">How we use it</h2>
        <p>To run the service, bill you accurately, prevent fraud, and provide support. We never sell your data.</p>
        <h2 className="text-lg font-semibold text-foreground">Encryption</h2>
        <p>All signalling is TLS 1.3. Call media is encrypted with SRTP between your browser and our edge.</p>
        <h2 className="text-lg font-semibold text-foreground">Data retention</h2>
        <p>Call metadata is retained for 12 months for billing and regulatory compliance, then deleted. You can request earlier deletion at any time.</p>
        <h2 className="text-lg font-semibold text-foreground">Your rights</h2>
        <p>You can export or delete your data from Settings, or by emailing privacy@ringlink.app.</p>
      </div>
    </div>
  );
}