import { createFileRoute } from "@tanstack/react-router";
import { RateCalculator } from "@/components/rate-calculator";

export const Route = createFileRoute("/_authenticated/dashboard/rates")({
  head: () => ({ meta: [{ title: "Rate calculator - Eginta" }] }),
  component: DashboardRatesPage,
});

function DashboardRatesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <RateCalculator
        showTeamCta={false}
        primaryHref="/dashboard"
        primaryLabel={(countryName) => `Call ${countryName}`}
        title="Rate calculator"
        description="Check per-minute mobile and landline rates before placing a call."
      />
    </div>
  );
}
