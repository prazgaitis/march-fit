# Strava Import Notification

**Date:** 2026-03-07
**Description:** Send users an in-app notification when a Strava activity is successfully imported via webhook.

## Tasks

- [x] Add `strava_import` notification type to backend
- [x] Insert notification in `createFromStrava` mutation (new activities only, not updates)
- [x] Add `strava_import` to rollup types to prevent spam from batch imports
- [x] Add icon, message, and link rendering in notifications list UI
