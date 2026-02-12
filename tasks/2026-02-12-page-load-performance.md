# 2026-02-12 Page Load Performance Fixes

Fix server-side query waterfalls causing sluggish page loads on Vercel.

## Changes

- [x] Add timing instrumentation to key pages (layout, challenge detail, dashboard, home)
- [x] Parallelize challenge detail page queries with Promise.all()
- [x] Parallelize layout auth calls (getToken + preloadAuthQuery)
- [x] Remove redundant isAuthenticated() call from dashboard page
- [x] Verify with typecheck and build

## Implementation Notes

### Layout (`apps/web/app/layout.tsx`)
- `getToken()` and `preloadAuthQuery()` now run in parallel via `Promise.all()`
- Added `[perf] layout auth` timing log

### Challenge Detail (`apps/web/app/challenges/[id]/page.tsx`)
- `getCurrentUser()` and `params` now resolve in parallel
- All 4 Convex queries (challenge, participants, activityTypes, isParticipating) now run in parallel via `Promise.all()`
- Previously these were 5 sequential network hops; now it's 2 (auth + parallel batch)
- Error handling preserved via `.catch()` on individual promises

### Dashboard (`apps/web/app/challenges/[id]/dashboard/page.tsx`)
- Replaced `isAuthenticated()` call with `getToken()` which is already cached via React.cache from `getCurrentUser()`'s earlier call — zero extra network round trips
- `getCurrentUser()` and `params` now resolve in parallel

### Home (`apps/web/app/page.tsx`)
- Added timing instrumentation only (redirect logic is already optimal)

### Build note
- `pnpm build` fails on `/api/webhooks/strava` due to missing `CONVEX_URL` at build time — this is a pre-existing issue on main, not caused by these changes
