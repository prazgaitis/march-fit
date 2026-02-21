# Centralize Points Display Components

**Date:** 2026-02-20

## Tasks

- [x] Create shared `formatPoints` utility in `apps/web/lib/points.ts`
- [x] Create `<PointsDisplay>` component in `apps/web/components/ui/points-display.tsx`
- [x] Update activity feed (`activity-feed.tsx`) to use `<PointsDisplay>`
- [x] Update activity log dialog (`activity-log-dialog.tsx`) to use shared `formatPoints` and `<PointsDisplay>`
- [x] Update activity detail (`activity-detail-content.tsx`) to use `<PointsDisplay>`
- [x] Update user profile (`user-profile-content.tsx`) to use `<PointsDisplay>`
- [x] Update challenge sidebar (`challenge-sidebar.tsx`) to use `formatPoints`
- [x] Update leaderboard components to use `formatPoints`
- [x] Update backend `getProfile` query to include `isNegative` in enriched activities
- [x] Verify: `pnpm typecheck` passes
- [x] Verify: `pnpm test -- --run` passes
