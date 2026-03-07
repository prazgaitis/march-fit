# Email Notifications for User Settings

**Date:** 2026-03-07
**Description:** Add email notification preferences to user settings, allowing users to opt in/out of email notifications per notification type. Emails sent via Resend.

## Schema Changes

- [x] Add `notificationPreferences` table to Convex schema (userId, emailEnabled per type)

## Backend

- [x] Create query to get user notification preferences
- [x] Create mutation to update notification preferences
- [x] Create internal action to send notification emails via Resend
- [x] Hook into `insertNotification` to trigger email sends when enabled

## Frontend

- [x] Add notification settings section to settings page with toggles per notification type
- [x] Wire up to backend queries/mutations

## Notification Types

Categories for email notifications:
- **Activity engagement:** likes, comments, comment likes
- **Social:** new followers, challenge joins, invite accepted
- **Achievements:** achievements, streaks
- **Strava:** activity imports
- **Mini-games:** partner/hunter/prey activity
- **Admin:** admin comments, admin edits
