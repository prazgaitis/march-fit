# Move Strava Webhook to Convex HTTP Action

**Date:** 2026-02-12
**Description:** Move Strava webhook handler from Next.js API route to Convex HTTP action so internal functions can be called correctly.

## Changes

- [x] Add `processStravaWebhook` internalAction to `packages/backend/actions/strava.ts`
- [x] Add GET and POST `/strava/webhook` routes to `packages/backend/http.ts`
- [x] Update `scripts/strava-webhook.ts` default callback URL to use `CONVEX_SITE_URL`
- [x] Delete `apps/web/app/api/webhooks/strava/route.ts`

## Implementation Notes

- The `processStravaWebhook` internalAction contains all business logic ported from the Next.js route
- Uses `coerceDateOnlyToString` from `packages/backend/lib/dateOnly` for date comparison
- HTTP POST handler stores payload first, then delegates to internalAction, always returns 200
- HTTP GET handler validates against `STRAVA_VERIFY_TOKEN` env var
- Follows same pattern as existing Stripe webhook in `http.ts`

## Post-Deploy Steps

1. Set `STRAVA_VERIFY_TOKEN` in Convex environment
2. Run `npx tsx scripts/strava-webhook.ts delete` to remove old subscription
3. Run `npx tsx scripts/strava-webhook.ts create` to create new subscription pointing to Convex
