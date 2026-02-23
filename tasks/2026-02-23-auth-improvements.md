# Auth Improvements: Last Login, Set Password, Page Redesign

**Date:** 2026-02-23
**Description:** Add last login method plugin, allow OAuth users to set a password, redesign auth pages, and make password reset testable locally.

## Plan

### Better Auth Last Login Method Plugin
- [x] Add `lastLoginMethod` server plugin in `packages/backend/auth.ts`
- [x] Add `lastLoginMethodClient` client plugin in `apps/web/lib/better-auth/client.ts`
- [x] Show "Last used" badge on sign-in page for the user's last auth method

### OAuth Users: Add Password
- [x] Add "Account Security" card to settings page with set/reset password option
- [x] OAuth-only users can trigger password reset email to set a credential password
- [x] Users with existing password see change password option

### Local Password Reset Testing
- [x] When `RESEND_API_KEY` is not set, log the full reset URL to console instead of failing silently
- [x] Add clear log message so developers can click the link directly

### Auth Page Redesign
- [x] Redesign sign-in page — cleaner layout, gradient accent, mobile responsive
- [x] Redesign sign-up page — match sign-in design, mobile responsive
- [x] Redesign forgot-password page — consistent styling
- [x] Redesign reset-password page — consistent styling
- [x] All pages remain fully mobile responsive

## Implementation Notes

- Last Login Method plugin: `better-auth/plugins` (server), `better-auth/client/plugins` (client)
- `setPassword` is server-only; for OAuth users the recommended approach is the forgot-password flow
- Cookie-only storage for last login method (no DB migration needed)
- Sign-in page shows "Last used" badges on Google button and email form button based on cookie
- Settings page has "Account Security" card with two options:
  - "Send Password Reset Link" — for OAuth users to set a first password, or anyone to reset
  - "Change Password" — inline form for users who already have a password
- Background gradient orbs (indigo/fuchsia) and the "MARCH FITNESS" wordmark brand all auth pages consistently
- All pages use `min-h-[100dvh]` for proper mobile viewport handling
- When `RESEND_API_KEY` is not set, the reset URL is printed to the Convex console for local testing
