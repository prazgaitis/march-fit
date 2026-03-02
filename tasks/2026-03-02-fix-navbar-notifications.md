# Fix Mobile Navbar & Add Notification Badges

**Date:** 2026-03-02

## Summary
Fix the confusing translucent/dimming behavior on the mobile bottom navbar and add unread notification count badges to both the desktop sidebar and mobile nav.

## Tasks

- [x] Remove translucent scroll-dimming behavior from mobile navbar (make it solid)
- [x] Create `markAllAsRead` mutation in backend
- [x] Create `useUnreadNotificationCount` hook with real-time Convex subscription
- [x] Add unread notification badge to desktop sidebar (DashboardNav)
- [x] Add unread notification badge to mobile nav (MobileNav)
- [x] Mark notifications as read when user visits the notifications page
- [x] Typecheck and lint pass
