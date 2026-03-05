# Feed Mobile UX - Compact Layout
**Date:** 2026-03-04

## Goals
- [x] Remove card wrappers on mobile feed — maximize horizontal space like X/Instagram
- [x] Make inline comments compact and Instagram-style (no avatars, bold username inline)
- [x] Show all comments under activities in the feed by default (not behind toggle)

## Implementation Notes
- On mobile: replace Card with edge-to-edge layout separated by dividers
- On desktop: keep Card treatment
- Comments: `**username** comment text` format, no avatar, compact spacing
