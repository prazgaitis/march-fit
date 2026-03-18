# User Tagging in Edit Activity + Mobile UI Improvements

**Date:** 2026-03-18

## Summary

Add user tagging support to activity editing (previously only available during creation) and improve the tagging UI for mobile devices.

## Changes

### Backend: `editActivity` mutation accepts `taggedUserIds`
- [x] Add `taggedUserIds: v.optional(v.array(v.id("users")))` to `editActivity` args
- [x] Sync tags on edit: remove tags no longer in list, add new tags via `createActivityTags` (handles dedup, validation, notifications, related activity linking)

### Frontend: Edit dialog supports user tagging
- [x] Add `editTaggedUserIds` state to activity detail content
- [x] Pre-populate from existing `activityData.taggedUsers` when opening edit dialog
- [x] Add tag people UI section (matching creation dialog pattern)
- [x] Pass `taggedUserIds` in edit submission payload

### Mobile UI improvements (both creation and edit dialogs)
- [x] Compact tag layout: badges and "Add" button on same row (saves vertical space)
- [x] Smaller tag badges: `text-xs` with `px-2 py-0.5` (vs `text-sm px-2.5 py-1`)
- [x] Inline "Add" pill button instead of full-width outline button
- [x] Popover opens upward (`side="top"`) to avoid being clipped by drawer bottom
- [x] Smaller search input and list items in popover (`text-xs`, `h-8`, `max-h-[150px]`)
- [x] Muted label styling (`text-xs text-muted-foreground`)
