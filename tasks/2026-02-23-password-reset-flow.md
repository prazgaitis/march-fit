# Password Reset Flow

**Date:** 2026-02-23
**Description:** Implement password reset (forgot password) flow using Better Auth's built-in `sendResetPassword` hook and Resend for transactional emails.

## Plan

### Backend (Convex)
- [x] Add `sendResetPassword` callback to Better Auth config in `packages/backend/auth.ts`
- [x] Use existing `@convex-dev/resend` component + branded email template to send reset emails

### Frontend (Next.js)
- [x] Create `/forgot-password` page — email input form that calls `betterAuthClient.forgetPassword()`
- [x] Create `/reset-password` page — new password form that reads `?token=` from URL and calls `betterAuthClient.resetPassword()`
- [x] Add "Forgot password?" link to sign-in page

### Config
- [x] Add `RESEND_API_KEY` note to `.env.example` (already required by `@convex-dev/resend`)

## Implementation Notes

- Better Auth's `emailAndPassword.sendResetPassword` callback runs inside the Convex action context, so we can use the `@convex-dev/resend` component directly.
- The reset link points to `{SITE_URL}/reset-password` and Better Auth appends `?token=...` or `?error=INVALID_TOKEN`.
- Emails use the existing branded `wrapEmailTemplate` + `emailButton` helpers from `packages/backend/lib/emailTemplate.ts`.
- Token expiry defaults to 1 hour (Better Auth default).
