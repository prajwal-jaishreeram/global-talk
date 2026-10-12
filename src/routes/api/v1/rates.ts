import { createFileRoute } from "@tanstack/react-router";
import { validateApiKeyHeader } from "@/lib/api/auth";
import { getRateForNumber } from "@/lib/rates";

export const Route = createFileRoute("/api/v1/rates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await validateApiKeyHeader(request.headers.get("authorization"));
        if (!auth.context) {
          return Response.json({ error: auth.error }, { status: auth.statusCode || 401 });
        }

        const url = new URL(request.url);
        const to = url.searchParams.get("to");

        if (!to) {
          return Response.json({
            min_retail_per_minute: 0.02,
            currency: "USD",
            billing_increment_seconds: 60,
            instruction: "Pass query param ?to=+14155552671 to calculate the exact rate for a destination.",
          });
        }

        const rateInfo = getRateForNumber(to);
        return Response.json({
          destination: to,
          country_code: rateInfo.country,
          type: rateInfo.type,
          rate_per_minute: rateInfo.rate,
          estimated_15min_cost: Math.round(rateInfo.rate * 15 * 10000) / 10000,
          currency: "USD",
        });
      },
    },
  },
});
