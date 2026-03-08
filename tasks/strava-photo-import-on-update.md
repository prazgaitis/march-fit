# Strava Photo Import on Activity Update

**Date:** 2026-03-07

When a Strava activity is updated, import any photos that were added, rescore to add photo bonus if criteria are met, and notify the user.

## Tasks

- [x] Add `strava_update` notification when existing activity is updated via Strava webhook
- [x] Add `strava_update` to notification dedup rollup types
- [x] Add `strava_update` icon and message in frontend notifications list
- [x] Verify photo import works on update (already handled by `mapStravaActivity` + `patchActivity`)
- [x] Verify rescoring with media bonus works on update (already handled by `calculateFinalActivityScore`)
- [x] Verify webhook wiring for `activity.update` events (already handled by `processStravaWebhook`)

## Implementation Notes

### What was already working
- Webhook handler (`processStravaWebhook`) treats both `create` and `update` events the same — fetches full activity from Strava API and calls `createFromStrava`
- `createFromStrava` already handles upsert: checks for existing activity by `externalId` and patches if found
- Photos are extracted via `extractStravaPhotos()` from `photos.primary.urls` in the Strava API response
- Media bonus (+1 point) is calculated via `calculateFinalActivityScore` with `includeMediaBonus: hasMedia`
- Points delta is correctly computed as `pointsEarned - existing.pointsEarned` on updates

### What was missing
- No notification sent when an existing activity is updated (only on initial create)
- Frontend had no display handling for `strava_update` notification type
