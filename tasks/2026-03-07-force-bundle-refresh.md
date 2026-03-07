# Force Bundle Refresh

**Date:** 2026-03-07
**Description:** Add a mechanism to force clients with stale JS bundles to refresh, using Convex real-time subscriptions to push a version signal.

## Implementation

- [x] Add `appConfig` table to Convex schema (single-doc, stores `bundleVersion`)
- [x] Add query (`queries/appConfig.ts`) to subscribe to current bundle version
- [x] Add mutation (`mutations/appConfig.ts`) to bump bundle version (admin-only)
- [x] Bake build-time version into client via `NEXT_PUBLIC_BUNDLE_VERSION` env var (set in deploy script)
- [x] Create `<BundleVersionGuard>` client component that compares baked version vs live version and prompts refresh
- [x] Wire guard into root layout
- [x] Update `vercel.sh` deploy script to bump version post-deploy

## Notes

- Uses Convex's existing real-time WebSocket — zero additional network cost
- No service worker, no polling, no middleware changes
- Clients see a non-intrusive toast when a new version is available
- Guard only activates after initial load (ignores first render) to avoid flash on fresh page loads
- `bundleVersion` is a simple incrementing integer
