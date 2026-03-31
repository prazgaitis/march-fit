# Wrapped Visual Enhancements
**Date:** 2026-03-31

Add animated bubble backgrounds and floating user photos to the Wrapped experience for a more visually engaging, Spotify Wrapped-style presentation.

## Implementation

- [x] Create CSS-only `BubbleBackground` component (animated gradient blobs with gooey SVG filter)
- [x] Define per-slide color palettes (16 unique themes matching each slide's accent colors)
- [x] Add CSS keyframe animations for bubble floats/rotations and photo floats
- [x] Extend wrapped backend query to return `activityPhotoIds` (up to 12 random user photos)
- [x] Create `FloatingPhotos` component (gently animated photos scattered around slide edges)
- [x] Integrate both into `WrappedViewer` with proper z-index layering
- [x] Floating photos appear on select slides: final-standing, activity-volume, fun-stats, thank-you
- [x] All animations respect `prefers-reduced-motion`
- [x] Typecheck and lint pass

## Notes

- No new dependencies added - bubble background uses pure CSS keyframes instead of `motion` library
- Photos use existing Cloudinary `thumbnail` preset (400px) for fast loading
- Videos are excluded from photo collection (only image public IDs)
- Bubble opacity set to 30% to keep content readable
- Photo opacity ranges 35-50% to stay subtle
- Mobile-first: all sizes use responsive classes, touch interactions unchanged
