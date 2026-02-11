# Prevent Early Activity Logging

**Date:** 2026-02-10
**Description:** Prevent users from logging activities before a challenge has started, both in the UI and via Strava webhooks.

## Requirements

- [x] Users should not be able to log activities in the UI until a challenge has started
- [x] Date comparison uses challenge start date vs user's local date (no timestamps)
- [x] Strava webhooks should noop for activities before the challenge start date
- [x] Strava date comparison uses the activity's local date (`start_date_local`)

## Implementation

### Backend - Server-side validation (`packages/backend/mutations/activities.ts`)
- [x] Added date-only comparison in the `log` mutation: compares the logged date against challenge start date
- [x] Throws descriptive error if activity date is before challenge start

### Backend - Strava activity type (`packages/backend/lib/strava.ts`)
- [x] Added `start_date_local` to `StravaActivity` interface
- [x] Updated `mapStravaActivity` to use `start_date_local` for the logged date (falls back to `start_date`)

### Strava Webhook (`apps/web/app/api/webhooks/strava/route.ts`)
- [x] Added `start_date_local` to the local `StravaActivity` interface
- [x] Changed date comparison from UTC timestamp comparison to date-only string comparison using the activity's local date
- [x] Activities with a local date before challenge start are silently skipped

### UI - Activity Log Dialog (`apps/web/components/dashboard/activity-log-dialog.tsx`)
- [x] Added `challengeStartDate` prop
- [x] Computes `challengeNotStarted` by comparing user's local date against challenge start date string
- [x] Shows a "Challenge not started" message with the start date when the challenge hasn't begun

### UI - Prop threading
- [x] `DashboardLayout` passes `challenge.startDate` to all `ActivityLogDialog` instances
- [x] `MobileNav` accepts and passes `challengeStartDate` to `ActivityLogDialog`
