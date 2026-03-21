# Round Score to Two Decimal Places in Strava Notifications

**Date:** 2026-03-21

## Description

Round the `pointsEarned` score to two decimal places when displaying in Strava activity imported/updated notifications.

## Changes

- [x] Round `pointsEarned` to 2 decimal places in `strava_import` notification message
- [x] Round `pointsEarned` to 2 decimal places in `strava_update` notification message
- [x] Round `previousPointsEarned` to 2 decimal places in `strava_update` notification message (when showing "was X")

## Implementation Notes

- Used `parseFloat(points.toFixed(2))` to round to 2 decimal places while stripping trailing zeros (e.g., `10.00` becomes `10`, `10.50` becomes `10.5`)
- Changes made in `apps/web/app/challenges/[id]/(dashboard)/notifications/notifications-list.tsx`
