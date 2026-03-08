# Strava Update: Sync Title, Media & Improve Notification

**Date:** 2026-03-07

When a Strava activity is updated (e.g., user adds photos or renames the activity), we should sync the title and media to our database and send a more descriptive notification.

## Changes

- [x] **Store Strava activity name as `notes`** — `mapStravaActivity` now sets `notes: stravaActivity.name` instead of `null`, so the Strava activity title is visible on the activity detail page
- [x] **Update `notes` on Strava update** — both the deleted-restore and regular update paths in `createFromStrava` now include `notes` in the patch (falls back to existing notes if Strava name is null)
- [x] **Media/photo handling** — `imageUrl` was already being updated on the update path; rescoring with `includeMediaBonus` was already in place. Added `hasNewMedia` flag to notification data to track when photos are newly added
- [x] **Improved `strava_update` notification message** — now shows point delta when score changed (e.g., "6 pts (was 5 pts)") and appends "with photos" when new media is detected

## Files Modified

- `packages/backend/lib/strava.ts` — `mapStravaActivity`: `notes: stravaActivity.name`
- `packages/backend/mutations/stravaWebhook.ts` — added `notes` to both update patch calls; added `hasNewMedia` to notification data
- `apps/web/.../notifications/notifications-list.tsx` — improved `strava_update` case with point delta and photo context

## Notes

The photo/imageUrl update and media bonus rescoring logic was already in place. If photos aren't appearing in production after a Strava update, the issue may be that Strava doesn't consistently fire update webhooks for photo additions, or there's a delay in photo processing on Strava's side before the detail API returns the photo URLs.
