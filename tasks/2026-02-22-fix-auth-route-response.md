# Fix Auth Route Handler Missing Response

**Date:** 2026-02-22
**Issue:** Sentry #7278292836 - Auth API Handler Missing Response Return

## Problem

Next.js API route handler at `apps/web/app/api/auth/[...all]/route.ts` fails to return a `Response` during POST requests to `/api/auth/sign-in/social`. Error observed on Mobile Safari 26.3 / iOS 18.7 in production.

The underlying `@convex-dev/better-auth` handler proxies auth requests via `fetch()` to the Convex site URL. If that fetch throws (network error, DNS failure, backend unavailable), the exception propagates past the `return response ?? new Response(...)` fallback, causing Next.js to report "No response is returned from route handler."

## Fix

- [x] Wrap `GET` and `POST` handlers in `betterAuthHandler` with try/catch to ensure a `Response` is always returned, even when the proxied fetch fails
- [x] Log errors for observability (`[auth-handler] GET/POST error:`)
- [x] Return `500 Internal Server Error` on caught exceptions
