# Browser-Based International Calling Tool — Build Plan

Adapting the original Next.js spec to this project's actual stack (TanStack Start + Lovable Cloud). All features preserved; only the framework layer changes.

## Stack adaptation

| Original (Next.js) | This project (TanStack Start) |
|---|---|
| Next.js App Router | TanStack Start file routes (`src/routes/`) |
| `app/api/*/route.ts` | `createServerFn` + server routes under `src/routes/api/public/*` for webhooks |
| Supabase via external keys | Lovable Cloud (managed Supabase, no key pasting) |
| Stripe via API keys + manual webhook | Lovable's built-in Stripe Payments (`enable_stripe_payments`) |
| `.env.local` | Lovable secrets (entered in a secure form) for Telnyx + Deepgram |
| Tailwind | Tailwind v4 (already configured) |

## Secrets I'll request from you

- `TELNYX_API_KEY`
- `TELNYX_SIP_CONNECTION_ID`
- `TELNYX_WEBRTC_USERNAME` (will be exposed to browser via a server-fn token mint, not as `VITE_`)
- `TELNYX_WEBRTC_PASSWORD`
- `DEEPGRAM_API_KEY`

Stripe keys are not needed — built-in Stripe Payments handles them.

## Build order

1. **Enable Lovable Cloud** (creates managed Supabase).
2. **DB schema migration** — `profiles`, `calls`, `credit_purchases` with the RLS + signup trigger from the spec.
3. **Enable Stripe Payments** + create 4 credit-package products (`$5 / $10 / $25 / $50` with bonus credits).
4. **Request Telnyx + Deepgram secrets** via the secrets form.
5. **Design system** — dark theme (`#0a0a0a`), electric-green accent (`#00ff88`), Geist Sans / Geist Mono.
6. **Routes**:
   - `/` landing
   - `/auth/login`, `/auth/signup`
   - `/_authenticated/dashboard` (dialer)
   - `/_authenticated/dashboard/history`
   - `/_authenticated/dashboard/credits`
   - `/_authenticated/dashboard/settings`
7. **Server fns** (`src/lib/*.functions.ts`):
   - `mintTelnyxToken` — server-side WebRTC credential issuance
   - `startCall`, `tickCall` (atomic credit deduction every 10s), `endCall`
   - `getCallHistory`, `getCreditBalance`
   - `createStripeCheckout` (via built-in Stripe)
8. **Server routes** (`src/routes/api/public/`):
   - `telnyx/webhook` — verify signature, update call status, trigger Deepgram transcription on recording
   - `stripe/webhook` — handled by built-in integration; credits credited on `checkout.session.completed`
9. **Dialer component** — number display, dial pad, country selector (`libphonenumber-js`), call button, active-call UI with timer and mute, real-time credit subscription via Supabase Realtime.
10. **Rate engine** — `src/lib/rates.ts` with per-country rates and `getRateForNumber` / `estimatedCostForDuration`.
11. **Hooks** — `useCall`, `useCredits`, `useCallHistory`.
12. **SEO** — sitemap + robots, per-route meta.

## Known constraints / honest caveats

- **No Geist fonts ship by default** — I'll wire them via Google Fonts (`Geist` + `Geist Mono`) in the root head.
- **Telnyx WebRTC SDK in browser**: requires `<ClientOnly>` wrappers; the SDK touches `window` at import time.
- **Atomic credit deduction**: implemented via a Postgres function `deduct_credits(user_id, amount)` returning the new balance or NULL if insufficient — called from `tickCall`.
- **Transcription**: triggered from the Telnyx recording webhook by POSTing the recording URL to Deepgram, then writing back to `calls.transcript`.
- **First build will be large** — expect multiple turns. I won't stop mid-feature, but I'll batch sensibly.

## Confirmation needed before I start

1. Proceed with **built-in Stripe Payments** (recommended) — or do you insist on BYOK Stripe with your own keys?
2. OK to enable Lovable Cloud now?

Reply "go" and I'll begin with step 1 (enable Cloud) and step 2 (schema migration) in the same turn.
