# Fix Mobile More Menu Taps

**Date:** 2026-03-19

## Problem

The mobile navigation "More" menu drawer opens but tapping on navigation items inside it doesn't work. The vaul drawer's drag-to-dismiss gesture handling intercepts touch events on the Link elements, preventing their click handlers from firing.

## Root Cause

The `Drawer` component from vaul attaches pointer/touch event handlers to the entire drawer content for drag-to-dismiss detection. On mobile, these handlers prevent the default browser behavior for taps on interactive elements (Links) inside the drawer. PR #226 fixed the same issue for the `ResponsiveDialog` component by adding `handleOnly`, but the `MoreDrawer` was not updated.

## Fix

- [x] Add `handleOnly` prop to the `MoreDrawer`'s `Drawer` component
- [x] Add `handleOnly` to `DrawerNestedRoot` in activity-log-dialog (same issue for activity type picker)
- [x] Add regression test that enforces all Drawer root usages include `handleOnly`
- This restricts vaul's drag handling to only the handle element, allowing taps on Links to fire normally
- The drawer can still be dismissed by tapping the overlay or by tapping a navigation link (which calls `setOpen(false)`)

## Files Changed

- `apps/web/components/dashboard/mobile-nav.tsx` — Add `handleOnly` to MoreDrawer's Drawer
- `apps/web/components/dashboard/activity-log-dialog.tsx` — Add `handleOnly` to nested activity type picker drawer
- `apps/web/tests/unit/drawer-handle-only.test.ts` — Regression test scanning all Drawer usages
