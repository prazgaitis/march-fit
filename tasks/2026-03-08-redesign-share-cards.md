# Redesign Share Cards

**Date:** 2026-03-08
**Description:** Fix and redesign the Instagram share card feature — add media support, fix text overlap, fix mobile download/share, and make it visually striking.

## Problems

1. No activity media (photos) displayed on the share card
2. Text overlapping (username overlaps date, date overlaps points)
3. "SELECTEDBONUSES" label is raw key instead of formatted
4. Design is generic/boring — doesn't match brand personality
5. Download and Share buttons broken on mobile (iOS Safari)

## Requirements

- [ ] Add activity media (photo) as background/hero image on share cards
- [ ] Fix all text overlap issues with proper spacing
- [ ] Fix mobile download (iOS Safari `<a>.click()` workaround)
- [ ] Fix mobile share (Web Share API blob handling)
- [ ] Redesign with bold, competitive aesthetic matching brand guidelines
- [ ] Update `ShareCardData` to include media URLs
- [ ] Update both data construction sites (activity-feed.tsx, activity-detail-content.tsx)
- [ ] Make renderer async to support image loading

## Implementation Notes
