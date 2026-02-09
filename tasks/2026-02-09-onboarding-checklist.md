# Onboarding Checklist Card

**Date:** 2026-02-09
**Description:** Replace the simple InviteCard on the dashboard with a 4-step onboarding checklist that guides users through setup before a challenge starts.

## Checklist Steps

- [x] **Fill out your bio** — Gender (male/female) + age. Optional/skippable.
- [x] **Complete payment** — Only shown if challenge requires payment. Reuses Stripe checkout pattern.
- [x] **Link Strava** — Optional. Reuses existing StravaConnectButton. Shows "Connected" when done.
- [x] **Invite friends** — Share invite link (copy/share) + enter emails to send invites via Resend.

## Implementation

- [x] Schema: Added `gender` and `age` optional fields to `users` table
- [x] Extended `updateUser` mutation with `gender` and `age` args
- [x] Added `sendInviteEmails` mutation to `challengeInvites.ts`
- [x] Created `OnboardingCard` component at `apps/web/components/dashboard/onboarding-card.tsx`
- [x] Replaced `InviteCard` with `OnboardingCard` in dashboard page
- [x] OnboardingCard auto-hides when all completable steps are done and user dismisses

## Files Changed

| File | Action |
|------|--------|
| `packages/backend/schema.ts` | Modified — added `gender`, `age` to users |
| `packages/backend/mutations/users.ts` | Modified — extended `updateUser` args |
| `packages/backend/mutations/challengeInvites.ts` | Modified — added `sendInviteEmails` |
| `apps/web/components/dashboard/onboarding-card.tsx` | Created — OnboardingCard component |
| `apps/web/app/challenges/[id]/dashboard/page.tsx` | Modified — swapped InviteCard for OnboardingCard |
