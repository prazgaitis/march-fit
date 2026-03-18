# Fix Activity User Tagging UI

**Date:** 2026-03-18
**Description:** The backend supported tagging users in activities (via `taggedUserIds`), but the activity log dialog had no UI to select users. Users couldn't tag anyone.

## Changes

- [x] Add `taggedUserIds` to form state in `ActivityLogDialog`
- [x] Add user picker UI (searchable popover with challenge participants)
- [x] Pass `taggedUserIds` to the `logActivity` mutation call
- [x] Show tagged users as removable chips
- [x] Filter out current user and already-tagged users from picker

## Implementation Notes

- Reuses the existing `useMentionableUsers` hook (same data source as @mention in notes)
- Uses Command/Popover pattern consistent with the ActivityTypePicker
- Tagged users shown as chips with X button to remove
- "Tag someone" button hidden when no more users available to tag
