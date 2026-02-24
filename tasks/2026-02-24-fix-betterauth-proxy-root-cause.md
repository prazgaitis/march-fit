# Fix Better Auth proxy root cause — 2026-02-24

Eliminate the custom auth proxy that was corrupting Set-Cookie headers, causing
recurring UNAUTHORIZED errors on `/api/auth/convex/token` and breaking sign-out,
password reset, and Google sign-in for production users.

## Problem

After deploying, auth would work briefly then fail with:

```
GET /api/auth/convex/token
ERROR [Better Auth]: APIError { status: 'UNAUTHORIZED', statusCode: 401 }
```

Sign-out, password reset emails, and Google sign-in all stopped working. This
affected real production traffic.

## Root Cause

The custom `proxyAuthRequest()` function in `server-auth.ts` consumed the
upstream Convex response body into an ArrayBuffer and rebuilt a new `Response`:

```ts
const upstreamBody = await upstream.arrayBuffer();
const headers = new Headers(upstream.headers);
headers.delete("content-length");
return new Response(upstreamBody, { status, statusText, headers });
```

The `new Headers(upstream.headers)` step could corrupt multi-valued `Set-Cookie`
headers. Better Auth sets multiple cookies per response (session token, JWT
cookie, session data cache), and when these got mangled the browser never stored
valid session cookies. The "works after deploy, stops later" pattern occurred
because the `cookieCache` (5min TTL) masked the issue briefly — cached session
data worked until it expired, then renewal required proper `Set-Cookie`
forwarding which was broken.

This custom proxy had accumulated 11+ PRs of fixes (PRs #61, #74, #76, #80, #81,
#82, #84, #87, #93, #95, #97), each addressing symptoms rather than the
fundamental issue.

## Fix

- [x] Replace the custom `proxyAuthRequest()` with the library's built-in
  handler (`convexBetterAuthNextJs().handler`). The library returns the `fetch()`
  Response object directly, which preserves all headers including multiple
  `Set-Cookie` values.
- [x] Remove temporary amber warning banner from the sign-in page (added in PR
  #97 as a user-facing notice).
- [x] Retain error handling wrappers around the library handler for logging.

## Why the library handler is better

The `@convex-dev/better-auth` library's handler does:

```ts
const newRequest = new Request(nextUrl, request);
newRequest.headers.set("host", new URL(siteUrl).host);
return fetch(newRequest, { method: request.method, redirect: "manual" });
```

Key difference: it returns the `fetch()` response **directly** — no body
consumption, no header rebuilding, no `Set-Cookie` corruption risk.

## Notes

- The original custom proxy was introduced in PR #81 to fix "Google sign-in 500
  on Vercel" due to body stream consumption issues. Modern Next.js/Vercel handles
  `new Request(url, request)` cloning correctly, making the workaround obsolete.
- If body stream issues recur on Vercel in the future, the fix should be upstream
  in the library, not a local proxy replacement.
