# Admin: Clear Test Payments

**Date:** 2026-02-20

When a challenge is in test mode for payments, allow admins to clear out payment information from the DB for individual users so they can re-test the signup and payment flow.

## Requirements

- [x] Add backend mutation to clear a user's payment data (participation + payment records)
  - Only works when challenge payment config is in test mode
  - Requires challenge admin permissions
  - Resets `paymentStatus` to "unpaid" on `userChallenges`
  - Deletes associated `paymentRecords` for that user+challenge
- [x] Add "Clear Payment" button per user on admin participants page
  - Only visible when challenge is in test mode
  - Shows confirmation before clearing
- [x] Add (i) tooltip on the payments admin page with Stripe test card info
  - Card number: 4242 4242 4242 4242
  - Expiry: any future date
  - CVC: any 3 digits
  - ZIP: any 5 digits
