# 2026-02-16 Mobile Convex feed connection

Date: 2026-02-16

- [x] Diagnose missing load-more and hanging following feed on mobile
- [x] Verify Convex client URL/transport path used by mobile browsers
- [x] Implement robust client URL resolution for loopback dev hosts
- [x] Add same-origin HTTP feed fallback path for websocket-degraded clients
- [x] Log websocket-degraded fallback activation/errors to Sentry (no user-facing alerts)
- [x] Add `platform` tag (`mobile`/`desktop`) to feed fallback Sentry events
- [x] Validate with typecheck/lint
