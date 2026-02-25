# Consolidate auth proxy into library patch — 2026-02-25

Eliminate the custom auth proxy handler that has accumulated 11+ PRs of fixes
by patching the Node 25 body-cloning issue directly in the library, then
delegating to the library handler.

## Problem

The custom `proxyHandler()` in `server-auth.ts` was introduced to work around
a Node 25+ crash where `new Request(url, originalRequest)` fails because the
body ReadableStream cannot be cloned. But maintaining a custom proxy has been
the root source of recurring auth outages:

- **Set-Cookie corruption** — earlier versions rebuilt `new Headers(upstream.headers)`
  which mangled multi-valued Set-Cookie headers
- **Google sign-in 500s** — body stream consumption issues
- **`instanceof Response` failures** — undici vs global Response mismatch on Vercel
- **`accept-encoding` header confusion** — response compression handling

Each fix addressed a symptom rather than the core issue: *the auth route handler
should be the library's responsibility, not custom application code*.

## Fix

- [x] **Patch the library's nextjs handler** (`@convex-dev/better-auth`) to
  replace `new Request(url, request)` with explicit body reading via
  `request.arrayBuffer()`, avoiding the Node 25+ crash. Added to the existing
  pnpm patch that already fixes the adapter date parsing.
- [x] **Remove the custom proxy** from `server-auth.ts` and delegate to the
  (now-patched) library handler: `getBetterAuthUtils().handler`
- [x] **Remove amber warning banner** from sign-in and sign-up pages
  (added in PR #102 as a user-facing notice during investigation)
- [x] **Disable verbose auth logging** — `verbose: false` on authComponent,
  remove unused `verboseAuthLogging` variable

## Why this approach is better

1. **Single source of truth** — the fix lives in a documented pnpm patch rather
   than a custom proxy that drifts from the library's behavior
2. **Less surface area** — ~60 lines of custom proxy code removed
3. **Library compatibility** — the handler retains exact library semantics
   (header forwarding, redirect handling) with only the body cloning fixed
4. **Patch is auditable** — `patches/@convex-dev__better-auth@0.10.11.patch`
   contains both the adapter date fix and the handler Node 25 fix

## Notes

- The patch fixes both `dist/nextjs/index.js` and `src/nextjs/index.ts`
- If `@convex-dev/better-auth` releases a version with the Node 25 fix
  upstream, the nextjs handler portion of the patch can be removed
- Upstream issue: https://github.com/get-convex/better-auth/issues/274
