# Fix Google Auth on Mobile + Sentry Instrumentation

**Date:** 2026-02-23
**Description:** After PR82 fixed Google auth on desktop, mobile is still broken. Add Sentry error capturing to the auth flow so we can diagnose the root cause, and add mobile-resilience improvements (errorCallbackURL, OAuth error param handling).

## Diagnosis

### Sentry Gaps
- [x] `server-auth.ts` auth proxy catches errors with `console.error` but never calls `Sentry.captureException()`
- [x] `better-auth-sign-in.tsx` / `better-auth-sign-up.tsx` show generic error message but don't report to Sentry — actual error details are lost
- [x] No Sentry breadcrumbs or context for the OAuth flow

### Mobile-Specific Issues
- [x] No `errorCallbackURL` on `signIn.social()` — if OAuth callback fails (ITP, in-app browser, state cookie lost), user gets stuck on raw error page
- [x] No handling of `error` query param that Better Auth appends on OAuth failure — user sees no feedback
- [x] Actual root cause unknown — needs real Sentry data from mobile sessions to diagnose

## Implementation

### Add Sentry to Auth Proxy (`server-auth.ts`)
- [x] Import `@sentry/nextjs` and add `captureException` in GET/POST error handlers
- [x] Add `captureMessage` for non-OK proxy responses with status/pathname context
- [x] Tag all events with `area: "auth-proxy"` for Sentry filtering

### Add Sentry to Sign-In/Sign-Up Components
- [x] Capture Google sign-in errors with full diagnostic context (error message, code, provider, flow)
- [x] Use custom error messages (e.g., "Google sign-in failed: ...") that won't be filtered by `ignoreErrors` `/^Failed to fetch/` pattern

### Mobile Resilience
- [x] Add `errorCallbackURL` to `signIn.social()` calls — redirects user back to sign-in page on OAuth failure instead of getting stuck
- [x] Handle `error` query param on sign-in/sign-up pages — show user-friendly error message and report to Sentry
- [x] Add Sentry breadcrumb when initiating Google sign-in for flow tracing

## Notes

- The `/^Failed to fetch/` pattern in `ignoreErrors` (instrumentation-client.ts) could suppress mobile network errors, but our explicit `captureException` calls use custom message strings that don't match this pattern
- Server-side Sentry config (`sentry.server.config.ts`) doesn't have `ignoreErrors`, so all server auth errors will be captured
- Client-side Sentry already tags events with `isMobile: "true"/"false"` — combined with `area: "auth"` tag, we can filter for mobile auth errors in Sentry dashboard
