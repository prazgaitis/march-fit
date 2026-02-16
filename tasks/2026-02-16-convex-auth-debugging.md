# 2026-02-16 Convex auth/transport debugging

Date: 2026-02-16

- [x] Add debug-gated Convex client verbose logging option
- [x] Add debug-gated Convex auth component verbose logging option
- [x] Add explicit notes for enabling AUTH_LOG_LEVEL=DEBUG during investigation
- [x] Validate with typecheck/lint

## Debug Enablement
- Set `NEXT_PUBLIC_CONVEX_DEBUG=1` for client-side Convex verbose logging and websocket disconnect diagnostics.
- Set `AUTH_LOG_LEVEL=DEBUG` for server-side auth diagnostics around `followingOnly` feed queries.
- Optional: set `CONVEX_AUTH_VERBOSE=1` to force verbose Better Auth adapter logging regardless of `AUTH_LOG_LEVEL`.
