# 2026-03-03 Fix Mobile Photo Loading & Add Lightbox

Photos are not loading in the activity feed on mobile devices. Additionally, add image optimization and a fullscreen photo lightbox (like Twitter/Instagram).

## Todo

- [x] Fix mobile feed to always include media URLs (lightweight mode was suppressing them)
- [x] Create a MediaLightbox component for fullscreen photo viewing with swipe/close
- [x] Integrate lightbox into activity feed, algorithmic feed, and activity detail page
- [x] Add image loading optimizations (lazy loading, async decode)
- [ ] Run typecheck and lint

## Root Cause

The `lightweightFeedMode` optimization (added Feb 13 for mobile LCP) sets `includeMediaUrls: false` for all mobile clients. This means media URLs are never fetched on mobile, so photos never render. The fix is to always include media URLs but optimize image sizes instead.

## Implementation Notes

### Fix: Always include media URLs
Changed `includeMediaUrls` from `!lightweightFeedMode` to `true` in:
- SSR dashboard page (both chronological and algorithmic feed initial fetches)
- Client-side Convex queries (both feed types)
- HTTP fallback feed path
`includeEngagementCounts` remains gated behind lightweight mode since it's less visible.

### New: MediaLightbox component (`components/ui/media-lightbox.tsx`)
- Fullscreen overlay with black background (like Twitter/Instagram)
- Keyboard navigation (Escape, ArrowLeft, ArrowRight)
- Touch swipe navigation for mobile
- Dot indicators on mobile, arrow buttons on desktop
- Image counter display
- Video support with autoplay
- Body scroll lock while open

### New: MediaGallery component (`components/media-gallery.tsx`)
- Extracted shared media grid layout from 3 locations into one reusable component
- Clickable thumbnails that open the lightbox
- Supports `feed` and `detail` variants
- `e.stopPropagation()` prevents card navigation when clicking photos
- Videos in thumbnails are muted (no controls until lightbox opens)

### Image optimization notes
- Added `loading="lazy"` and `decoding="async"` on feed thumbnails
- Next.js `<Image>` is not ideal here since Convex storage uses signed/temporary URLs that may expire; caching conflicts with URL rotation
- True image resizing (generating thumbnails on upload) would be a separate future effort
