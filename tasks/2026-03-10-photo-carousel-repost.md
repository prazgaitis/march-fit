# Photo Carousel & Activity Reposting

**Date:** 2026-03-10
**Description:** Instagram-style full-height photo carousel in feed + activity reposting system

## Photo Carousel

- [x] Replace grid-based MediaGallery with full-height carousel for feed variant
  - Carousel uses aspect-square with swipe navigation and CSS transitions
  - Media rendered full-width (edge-to-edge) in feed, outside card padding
- [x] Show dot indicators underneath for multi-photo posts
  - Active dot stretches wider with white fill; inactive dots are smaller with 40% opacity
- [x] Support swipe gestures (mobile) and arrow click (desktop) to cycle through photos
  - 50px touch threshold for swipe, ChevronLeft/Right arrows on desktop (hidden on mobile)
  - Counter badge (1/N) shown on desktop top-right
- [x] Keep grid/lightbox for detail page variant unchanged
  - MediaGallery now splits into MediaCarousel (feed) and MediaGrid (detail) internally
  - Lightbox still opens on tap/click from either variant

## Repost System

### Backend (Convex)

- [x] Add `reposts` table to schema (userId, activityId, challengeId, createdAt)
  - Indexes: activityId, userId, activityUserUnique, challengeCreatedAt
- [x] Add `repostCount` field to activities table for denormalized count
- [x] Add repost toggle mutation (create/delete repost record, increment/decrement count, send notification)
  - `mutations/reposts.ts` — toggle pattern matching likes
- [x] Add repost count to feed scoring (repostCount boosts feedScore)
  - +8 per repost, capped at 40 (in engagement score)
  - Feed score recomputed on repost/unrepost
- [x] Add "repost" notification type to notifications system
  - Added to rollup dedup types (1-hour window, dedup by activityId)
- [x] Add repost data to activity queries (repostedByUser, repostCount)
  - `getById` and `getChallengeFeed` both return `reposts` and `repostedByUser`

### Frontend

- [x] Add repost button to activity action bar (between comment and share)
  - Emerald-colored Repeat2 icon, toggles repost state
  - Shows count when engagement counts are enabled
- [x] Show repost notification type in notifications panel
  - Emerald Repeat2 icon, message: "[name] reposted your activity"
  - Links to the reposted activity
