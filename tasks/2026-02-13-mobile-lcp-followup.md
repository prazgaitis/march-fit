# 2026-02-13 Mobile LCP Follow-up

Investigate why mobile LCP is still ~60s on local-network testing despite recent page-load performance fixes.

## Todo

- [x] Validate and reproduce the mobile LCP bottleneck locally
- [x] Identify current critical rendering blockers in app shell/home route
- [x] Implement targeted fix(es) for mobile-first loading path
- [x] Verify with build/typecheck and summarize remaining risks

## Notes

- Development-only `react-grab` scripts from `unpkg` are now disabled by default and only loaded when `NEXT_PUBLIC_ENABLE_REACT_GRAB=1`.
- Production follow-up: `/challenges` no longer waits on client-side Convex subscription bootstrap; it server-fetches `api.queries.challenges.listPublic` and renders cards from server data.
- LAN-specific client URL rewrite was removed per request; production fix remains the `/challenges` server-side fetch path.
- Mobile feed follow-up: `getChallengeFeed` now supports lightweight response flags (`includeEngagementCounts`, `includeMediaUrls`), and mobile clients request lightweight mode to avoid expensive per-item count scans and media URL generation during initial load.
- Added SSR initial-feed hydration for dashboard: server fetches first feed page via authenticated query and passes it into `ActivityFeed` so first content render does not wait for client websocket/query startup.
