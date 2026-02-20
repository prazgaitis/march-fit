# Activity Type Ordering on "Earning Points" Page

**Date:** 2026-02-20

## Changes

- [x] Add `sortOrder` to `activityTypes` and `categories` schema
- [x] Add `sortOrder` and `categoryId` to API update mutation
- [x] Add `sortOrder` to activity type mutations (create, update)
- [x] Sort categories and activity types by `sortOrder` on frontend
- [x] Remove "Other" section (uncategorized items)
- [ ] Update production data via `npx convex run --prod`
