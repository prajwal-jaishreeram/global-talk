import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RateCalculator } from "@/components/rate-calculator";

export const Route = createFileRoute("/rates")({
  head: () => ({
    meta: [
      { title: "Rate Calculator - Ringringa" },
      {
        name: "description",
        content: "Calculate per-minute rates for international calls with Ringringa.",
      },
    ],
  }),
  component: RatesPage,
});

function RatesPage() {
  return (
    <div className="min-h-screen bg-[#F2F0EB] text-[#1C1C1B]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <RateCalculator />
      </main>
      <SiteFooter />
    </div>
  );
}
