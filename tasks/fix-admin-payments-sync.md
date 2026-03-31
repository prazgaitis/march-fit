# Fix Admin Payments Config Sync

**Date:** 2026-02-20
**Description:** Admin panel payments section was not correctly syncing form state with the challengePaymentConfig table, causing saved values to be overwritten with defaults.

## Bugs Found

- [x] `getPaymentConfig` query did not return `allowCustomAmount` field — donation mode toggle always reset to off on page load
- [x] `useEffect` only synced `allowCustomAmount` from server, not `priceInDollars`, `testMode`, or publishable keys — saving would reset price to $0
- [x] `handleSave` sent `formData.testMode` (stale default of `true`) instead of the server's `paymentConfig.testMode` — could flip test mode on every save

## Changes

### `packages/backend/queries/paymentConfig.ts`
- Added `allowCustomAmount` to the `getPaymentConfig` query return object

### `apps/web/app/challenges/[id]/admin/payments/page.tsx`
- Expanded `useEffect` to sync `testMode`, `priceInDollars`, `allowCustomAmount`, `stripePublishableKey`, and `stripeTestPublishableKey` from server state when `paymentConfig` loads
- Changed `handleSave` to use `paymentConfig?.testMode` (authoritative server state) instead of `formData.testMode` (stale local state)
