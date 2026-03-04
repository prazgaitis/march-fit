# Mobile Activity Logging UX Improvements

**Date:** 2026-03-04

## Problem

On mobile, tapping "Log Activity" opens a bottom drawer (Vaul). Two UX issues:

1. **Activity type selector**: Uses a Popover+Command combobox. When the search input gets focus, the mobile keyboard pushes up the viewport — lower activity types become unreachable because the popover's `max-h-[60vh]` gets squeezed by the keyboard.
2. **Date picker**: Opens a full calendar popover which is heavy for the common case (today/yesterday). Also triggers keyboard/viewport issues on mobile.

## Solution

1. Replace the Popover-based activity type selector with a **nested Vaul drawer** on mobile. Desktop keeps the existing Popover behavior unchanged.
2. Replace the calendar date picker on mobile with a **horizontal quick-pick** showing Today, Yesterday, and 2 days ago as tappable pills. Each pill shows the actual date (e.g. "Mar 4") subtly below the label — helpful past midnight. Desktop keeps the full calendar picker.

## Implementation

- [x] Export `DrawerNestedRoot` from `apps/web/components/ui/drawer.tsx` (wraps `DrawerPrimitive.NestedRoot`)
- [x] Extract `ActivityTypePicker` component in `activity-log-dialog.tsx`
  - Shared `ActivityTypePickerContent` renders the Command search + list
  - On mobile (`useIsMobile()`): opens a nested drawer with ~85vh height
  - On desktop: uses existing Popover with radix positioning
- [x] Extract `QuickDatePicker` component in `activity-log-dialog.tsx`
  - On mobile: horizontal scrollable row of pill buttons (Today, Yesterday, 2 days ago) with subtle date labels
  - On desktop: existing calendar DatePicker with "Use today" link
- [x] Replace inline Popover and DatePicker usage in main dialog with new components
- [x] Typecheck passes

## Files Changed

- `apps/web/components/ui/drawer.tsx` — Added `DrawerNestedRoot` export
- `apps/web/components/dashboard/activity-log-dialog.tsx` — Added `ActivityTypePicker`, `ActivityTypePickerContent`, and `QuickDatePicker` components; replaced inline combobox and date picker
