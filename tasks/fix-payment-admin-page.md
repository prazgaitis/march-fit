# Fix Payment Admin Page

**Date:** 2026-04-02

## Problems
1. Admin page doesn't populate form with existing payment config values on load
2. Masked secret keys are never displayed (maskKey exists but isn't used)
3. `allowCustomAmount` not returned from `getPaymentConfig` query
4. Saving with empty form can overwrite existing config with zeros

## Implementation

- [x] Update `getPaymentConfig` query to return masked secret keys and `allowCustomAmount`
- [x] Update admin page `useEffect` to populate all form fields from existing config
- [x] Show masked key values in the UI when keys exist
- [x] Set prod Stripe keys for March 2027 challenge via Convex CLI
