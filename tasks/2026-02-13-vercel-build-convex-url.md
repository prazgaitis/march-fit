# 2026-02-13 Fix Vercel build failure for Strava callback route

- [x] Identify build-time crash source in `/api/strava/callback`
- [x] Prevent module-scope Convex client initialization without env vars
- [x] Validate with typecheck
