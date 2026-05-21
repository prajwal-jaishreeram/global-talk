import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact - Ringlink" },
      { name: "description", content: "Get in touch with the Ringlink team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Contact from ${form.name || "website"}`);
    const body = encodeURIComponent(`${form.message}\n\nFrom: ${form.name} <${form.email}>`);
    window.location.href = `mailto:support@ringlink.app?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        Questions about pricing, integrations, or your account? We reply within one business day.
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <a href="mailto:support@ringlink.app" className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Support</div>
              <div className="text-sm text-muted-foreground">support@ringlink.app</div>
            </div>
          </a>
          <a href="mailto:sales@ringlink.app" className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40">
            <MessageSquare className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Sales</div>
              <div className="text-sm text-muted-foreground">sales@ringlink.app</div>
            </div>
          </a>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border/60 bg-card p-6">
          <label className="block text-sm">
            <span className="text-foreground">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">Message</span>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <Button type="submit" className="w-full">Send message</Button>
          {sent && (
            <p className="flex items-center gap-2 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Your mail app should open now.
            </p>
          )}
        </form>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}