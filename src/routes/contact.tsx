import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { sendContactSupportEmail } from "@/lib/contact.functions";
import { CheckCircle2, Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Dispatch — AgentCall" },
      { name: "description", content: "Get in touch with the AgentCall telephony engineering team." },
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
      setError(err?.message ?? "Could not send your message. Please email directly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#1C1C1B] dark:bg-[#0D0D11] dark:text-[#F3F3F5] transition-colors font-sans flex flex-col justify-between">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Dispatch & Info */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="mono text-[11px] text-[#8B6B55] dark:text-[#C9A690] uppercase tracking-widest mb-3 font-semibold">
                ◆ Dispatch & Support
              </div>
              <h1 className="serif text-4xl sm:text-5xl font-light mb-4 text-foreground leading-[1.05]">
                Direct line to the team.
              </h1>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                Questions about high-volume agent API caps, custom rate cards, or integration questions?
                Send a transmission below.
              </p>
            </div>

            <div className="border-t border-border pt-6 space-y-5">
              <div>
                <div className="mono text-[11px] uppercase font-bold text-muted-foreground mb-1">Direct Email</div>
                <a
                  href="mailto:prajwalshindeee@gmail.com"
                  className="text-sm font-medium hover:underline flex items-center gap-2 text-foreground"
                >
                  <Mail className="h-4 w-4 text-[#8B6B55] dark:text-[#C9A690]" />
                  prajwalshindeee@gmail.com
                </a>
              </div>
              <div>
                <div className="mono text-[11px] uppercase font-bold text-muted-foreground mb-1">Response Latency</div>
                <p className="text-xs text-muted-foreground font-light">Under 12 hours on business days</p>
              </div>
              <div>
                <div className="mono text-[11px] uppercase font-bold text-muted-foreground mb-1">Security Model</div>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  All calls run over encrypted WebRTC SIP trunks with zero recording.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <form
              onSubmit={submit}
              className="bg-card dark:bg-[#16161B] border border-border p-6 sm:p-7 space-y-4 shadow-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mono text-[11px] uppercase tracking-wider block mb-1 text-muted-foreground font-medium">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none focus:border-foreground text-foreground font-light"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mono text-[11px] uppercase tracking-wider block mb-1 text-muted-foreground font-medium">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none focus:border-foreground text-foreground font-light"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="mono text-[11px] uppercase tracking-wider block mb-1 text-muted-foreground font-medium">Subject</label>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm outline-none focus:border-foreground text-foreground font-light"
                  placeholder="Agent workflow, higher limits, or billing"
                />
              </div>

              <div>
                <label className="mono text-[11px] uppercase tracking-wider block mb-1 text-muted-foreground font-medium">Message</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-background border border-border p-3 text-sm outline-none focus:border-foreground text-foreground font-light resize-none"
                  placeholder="How can we help your team or agent deployment?"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="mono text-xs border border-foreground bg-foreground text-background px-8 py-3 hover:opacity-90 transition-all font-semibold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {sending ? "TRANSMITTING..." : "SEND TRANSMISSION"}
              </button>

              {sent && (
                <p className="flex items-center gap-2 mono text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Message received. We will reply via email shortly.
                </p>
              )}
              {error && <p className="mono text-xs text-red-600">{error}</p>}
            </form>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
