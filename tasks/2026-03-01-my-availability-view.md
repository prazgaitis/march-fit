# My Availability View on Earning Points Page
**Date:** 2026-03-01

## Summary
Add a "My Availability" tab as the default view on the activity-types page, showing a compact mobile-first view of what activities are available this week, with usage counts for limited activities.

## Tasks
- [x] Add `getAvailabilityForUser` query to backend
- [x] Create `activity-types-page-content.tsx` wrapper with tab toggle
- [x] Create `availability-view.tsx` compact list view
- [x] Update `page.tsx` to use new wrapper
- [x] Verify with `pnpm typecheck` — passes
