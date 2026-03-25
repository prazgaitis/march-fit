# Achievement Admin Editing & Activity Type Kinds

**Date:** 2026-03-24

## Achievement Admin Editing

Add inline editing support for achievements in the admin panel. The backend `updateAchievement` mutation already exists but the UI only has create + delete.

- [x] Extract achievement form fields into a reusable component
- [x] Add edit mode to achievement list rows (click to expand into form)
- [x] Wire up `updateAchievement` mutation
- [x] Pre-populate form with existing achievement data when editing

## Activity Type `kind` Field

Add a `kind` field to `activityTypes` (and `templateActivityTypes`) to semantically classify activity types orthogonally to the existing `categoryId` (which drives Category Leader leaderboard).

Values: `core`, `challenge`, `bonus`, `penalty`, `tracking`

- [x] Add `kind` to schema (`activityTypes` and `templateActivityTypes`)
- [x] Add `kind` to all create/update mutations (internal, public, API)
- [x] Write `backfillKind` mutation with heuristic classification
- [x] Add `kind` selector to admin activity types table (create + edit)
- [x] Add `kind` column to admin activity types table display
- [ ] Run backfill on production data
- [ ] Verify classifications are correct, fix any mismatches via admin UI
