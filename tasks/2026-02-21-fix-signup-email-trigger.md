# Fix On-Signup Email Trigger

**Date:** 2026-02-21

The "On Sign-Up" email trigger was not firing when new participants joined a challenge.

## Root Causes

### 1. `.first()` bug in `participations.join()`
- [x] The code used `.first()` to check if any on_signup email sequences existed, then checked `.enabled` on just that one result
- [x] If the first on_signup sequence in the DB was disabled, no emails would be triggered even if other enabled sequences existed
- [x] Fixed by using `.collect()` and `.some(seq => seq.enabled)` to check all sequences

### 2. Payment flow never triggered signup emails
- [x] When users joined via payment, the flow bypassed `participations.join()` entirely
- [x] `prepareCheckout` created the `userChallenges` entry but never triggered emails
- [x] `handlePaymentSuccess` (webhook) and `completeVerification` (fallback) marked payment as paid but never triggered emails
- [x] Fixed by adding `scheduleSignupEmails()` helper to `payments.ts` that checks for enabled on_signup sequences and schedules `triggerOnSignup`
- [x] Both `handlePaymentSuccess` and `completeVerification` now trigger signup emails after confirming payment

## Files Changed

- `packages/backend/mutations/participations.ts` - Fixed `.first()` to `.collect()` + `.some()` for checking enabled sequences
- `packages/backend/mutations/payments.ts` - Added `scheduleSignupEmails()` helper, called from `handlePaymentSuccess` and `completeVerification`
- `apps/web/tests/api/signup-email-trigger.test.ts` - 14 tests covering triggerOnSignup, join flow, and payment flow

## Implementation Notes

- Emails are sent asynchronously via `ctx.scheduler.runAfter(0, ...)` so they don't block the join/payment flow
- The `triggerOnSignup` internal mutation has built-in dedup protection (checks `emailSends` table before sending)
- Errors in email sending are caught and logged without failing the join/payment operation
- For already-completed payments (`completeVerification` with `alreadyCompleted: true`), no emails are triggered
