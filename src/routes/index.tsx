import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Globe, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ringlink — Browser-based international calling" },
      {
        name: "description",
        content:
          "Make low-cost international calls from your browser. Pay-as-you-go credits, crystal-clear HD audio, no app install.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Phone className="h-4 w-4" />
            </span>
            Ringlink
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/auth/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Now in beta
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
            Call anywhere.
            <br />
            <span className="text-primary">From your browser.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            HD international calling powered by a global carrier network. Pay only for what
            you use — no contracts, no apps, no SIM swaps.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/auth/signup">
              <Button size="lg" className="text-base">Start calling — $5 trial credit</Button>
            </Link>
            <Link to="/auth/login">
              <Button size="lg" variant="outline" className="text-base">I have an account</Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            { icon: Globe, title: "200+ countries", body: "Per-minute rates from $0.01. Transparent pricing — see every cent." },
            { icon: Zap, title: "Instant connect", body: "Sub-second call setup over WebRTC. No downloads, no plugins." },
            { icon: ShieldCheck, title: "End-to-end secure", body: "TLS + SRTP encryption. Your conversations stay private." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ringlink. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
