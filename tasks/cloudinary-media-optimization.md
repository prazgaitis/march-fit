# Cloudinary Media Optimization Pipeline

**Date:** 2026-03-08
**Description:** Add image/video optimization via Cloudinary with per-user beta rollout

## Implementation

- [x] Add `cloudinaryPublicIds` field to activities schema
- [x] Create `media-optimizer.ts` — vendor-agnostic upload + URL generation utilities
- [x] Create `use-optimized-media.ts` — React hook for display gating
- [x] Update `MediaGallery` to render optimized URLs when available
- [x] Update `activity-log-dialog.tsx` to upload to Cloudinary when enabled
- [x] Update backend queries to return `cloudinaryPublicIds` (activities, algorithmicFeed)
- [x] Update backend mutations to accept `cloudinaryPublicIds` in `log` mutation
- [x] Update `feedScore.ts` to count optimized media in mediaCount
- [x] Update `story-utils.ts` to handle optimized media
- [x] Update `stories-section.tsx` to pass `useOptimized` flag
- [x] Update `activity-feed.tsx` types to include `cloudinaryPublicIds`
- [x] Update `activity-detail-content.tsx` to pass optimized media to gallery
- [x] Update `algorithmic-feed.tsx` types and gallery
- [x] Create backfill action (`backfillCloudinaryMedia.ts`)
- [x] Add env var examples to `.env.example`

## Notes

- Per-user beta via `NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS` env var
- Without env vars, everything works as before (Convex storage fallback)
- Frontend uses vendor-agnostic names (`media-optimizer`, `useOptimizedMedia`)
- DB field stays as `cloudinaryPublicIds` (already deployed)
- Backfill: `npx convex run actions/backfillCloudinaryMedia:backfill '{"daysBack": 4}'`
