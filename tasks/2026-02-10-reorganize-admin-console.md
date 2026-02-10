# Reorganize Admin Console — 2026-02-10

Make the admin console a world-class "mission control" by consolidating related sections, reducing top-level navigation clutter, and eliminating duplication.

## Current State

11 flat top-level tabs with no visual grouping:
`Overview | Settings | Flagged | Activity Types | Integrations | Strava Preview | Achievements | Mini Games | Emails | Participants | Payments`

### Issues Identified

1. **Strava Preview is redundant with Integrations** — Both deal with Strava activity scoring. Integrations already has a sample scoring preview; Strava Preview adds real-participant testing. These belong together.
2. **No logical grouping** — Scoring-related pages (Activity Types, Integrations, Achievements) are interspersed with people-management pages (Participants, Flagged, Payments).
3. **11 tabs is too many** — Causes cognitive overload and makes it hard to find things quickly.

## Changes

### 1. Merge Strava Preview into Integrations
- [x] Add a "Test with Participants" tab inside the Integrations page
- [x] Move Strava Preview client component into the integrations section
- [x] Remove the standalone `/admin/strava-preview` route

### 2. Group Navigation with Visual Sections
- [x] Redesign `AdminNavigation` to support labeled groups with dividers
- [x] Organize into logical groups:
  - **Monitor**: Overview, Flagged Activities
  - **Scoring**: Activity Types, Integrations, Achievements
  - **Engage**: Mini Games, Emails
  - **People**: Participants, Payments
  - **Configure**: Settings

### 3. Result
10 → reduced from 11 tabs by merging Strava Preview into Integrations.
Grouped navigation makes related functionality discoverable at a glance.

## Implementation Notes

- Navigation groups use subtle zinc-600 labels and dividers
- Existing URLs and functionality preserved (no breaking changes)
- The Integrations page gains a tab bar to switch between "Mappings" and "Test with Participants"
