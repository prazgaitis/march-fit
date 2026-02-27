# Shared Dashboard Layout

**Date:** 2026-02-27

## Summary

Refactored challenge dashboard routes to use a shared layout via route groups.
Navigation between dashboard, leaderboard, forum, etc. now does client-side transitions
without re-mounting the nav/sidebar.

## Implementation

- [x] Create `(dashboard)` route group under `challenges/[id]/`
- [x] Add shared `(dashboard)/layout.tsx` that fetches auth + challenge + participation + dashboardData once
- [x] Add `DashboardShell` client component for pathname-based hideRightSidebar
- [x] Move dashboard, leaderboard, notifications, forum, activity-types, users, activities, settings under `(dashboard)/`
- [x] Strip `DashboardLayoutWrapper` from each page; layout provides the shell
- [x] Remove now-unused `dashboard-layout-wrapper.tsx`
- [x] Fix invite page import path for ActivityTypesList

## Result

- Layout (nav, sidebar) persists across navigations within challenge routes
- Only the page content segment is re-fetched on navigation
- Auth + challenge access check done once per layout, not per page
- Sidebar shows leaderboard/stats on dashboard and notifications; hidden on other sections
