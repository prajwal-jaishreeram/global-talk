import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Clock3, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { sendContactSupportEmail } from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact - Ringringa" },
      { name: "description", content: "Get in touch with the Ringringa team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const sendSupportEmail = useServerFn(sendContactSupportEmail);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setSent(false);
    setError(null);
    try {
      await sendSupportEmail({ data: form });
      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      setError(err?.message ?? "Could not send your message. Please email support directly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.045)_44%,transparent_72%)]"
        />
        <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-8 sm:px-6 md:py-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start lg:px-10 lg:pb-16 lg:pt-10">
          <div className="order-2 lg:order-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <MessageSquare className="h-3.5 w-3.5" />
              Contact Ringringa
            </span>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Get clear answers before your next call.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Send a support question, pricing request, or business inquiry. We keep replies direct
              and account-specific.
            </p>

            <div className="mt-8 grid gap-3">
              <a
                href="mailto:prajwalshindeee@gmail.com"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-sm transition hover:border-primary/40 hover:bg-white/[0.055]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">Support inbox</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      prajwalshindeee@gmail.com
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </a>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <div className="mt-3 text-sm font-medium">Response time</div>
                  <div className="mt-1 text-sm text-muted-foreground">One business day</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <div className="mt-3 text-sm font-medium">Account help</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Billing, calls, and access
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="order-1 rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-7 lg:order-2"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h2 className="text-xl font-semibold">Send a message</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your message goes straight to the support inbox.
                </p>
              </div>
              <span className="hidden rounded-full bg-call/10 px-3 py-1 text-xs font-medium text-call sm:inline-flex">
                Secure
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-foreground">Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60"
                  placeholder="Your name"
                />
              </label>
              <label className="block text-sm">
                <span className="text-foreground">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60"
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="text-foreground">Subject</span>
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60"
                placeholder="Billing, calls, pricing, or account help"
              />
            </label>

            <label className="mt-4 block text-sm">
              <span className="text-foreground">Message</span>
              <textarea
                required
                rows={6}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60"
                placeholder="Tell us what you need help with."
              />
            </label>

            <Button type="submit" size="lg" className="mt-5 w-full gap-2" disabled={sending}>
              {sending ? "Sending..." : "Send message"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {sent && (
              <p className="mt-4 flex items-center gap-2 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Message sent. Support will reply by
                email.
              </p>
            )}
            {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
