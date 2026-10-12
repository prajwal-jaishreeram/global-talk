import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RateCalculator } from "@/components/rate-calculator";

export const Route = createFileRoute("/rates")({
  head: () => ({
    meta: [
      { title: "Rate Calculator — AgentCall" },
      {
        name: "description",
        content: "Calculate per-minute rates for international calls with AgentCall.",
      },
    ],
  }),
  component: RatesPage,
});

function RatesPage() {
  return (
    <div className="min-h-screen bg-white text-[#1C1C1B] dark:bg-[#0D0D11] dark:text-[#F3F3F5] transition-colors flex flex-col justify-between">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16 flex-1 w-full">
        <RateCalculator />
      </main>
      <SiteFooter />
    </div>
  );
}
