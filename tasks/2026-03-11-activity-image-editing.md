# Activity Image Editing & Strava Media Persistence

**Date:** 2026-03-11
**Description:** Allow editing images on activities (including Strava/Cloudinary/URL-based media) and prevent deleted Strava images from returning on sync.

## Changes

### Schema
- [x] Added `stravaMediaDismissed` optional boolean to `activities` table to track when a user explicitly removes Strava-imported media

### Backend (`editActivity` mutation)
- [x] Accept `cloudinaryPublicIds` and `imageUrl` arguments so all media types can be edited
- [x] Compute `hasMedia` using effective values for all three media types (Convex, Cloudinary, URL)
- [x] Patch activity with cloudinary and imageUrl changes when provided
- [x] Set `stravaMediaDismissed: true` when user removes all media from a Strava activity

### Backend (Strava sync - `createFromStrava`)
- [x] Check `stravaMediaDismissed` flag on existing activities before overwriting `imageUrl`
- [x] Skip `pendingMediaCount` updates when media has been dismissed
- [x] Applies to both soft-deleted re-import and normal update paths

### Frontend (Edit dialog)
- [x] Updated `ExistingMedia` interface with `source` field ("convex" | "cloudinary" | "url") and optional `cloudinaryId`
- [x] `openEditDialog` now loads media from all three sources: Convex storage, Cloudinary, and legacy imageUrl
- [x] `handleEditSubmit` splits kept media back by source and sends appropriate fields to the mutation
- [x] Change detection works independently per media type

## Notes
- Legacy `imageUrl` (Strava photos) only shown in edit if no Convex/Cloudinary media exists (avoids duplicates)
- When `imageUrl` is set to `null` from the client, it's converted to `undefined` to clear it in Convex
- The `stravaMediaDismissed` flag is permanent per-activity; future Strava updates won't restore dismissed media
