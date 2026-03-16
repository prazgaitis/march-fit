# Fix Mobile Keyboard Layout Issues in Activity Log Drawer

**Date:** 2026-03-16

## Problem

When logging a new activity on mobile, opening the keyboard causes the responsive dialog (Vaul drawer) layout to break. The drawer resizes when the keyboard appears and doesn't properly restore when the keyboard is dismissed.

## Root Cause

The `DrawerContent` in `responsive-dialog.tsx` uses `max-h-[96dvh]` (dynamic viewport height). On mobile:
- `dvh` shrinks when the virtual keyboard opens (it tracks the visual viewport)
- This causes the drawer to collapse/resize, pushing content around
- When the keyboard dismisses, the resize animation is janky and doesn't fully recover

Additionally, the Vaul drawer allows swipe-to-dismiss from anywhere inside the content, which conflicts with scrolling the form.

## Solution

- [x] Change `max-h-[96dvh]` to `max-h-[96svh]` — `svh` (small viewport height) stays stable regardless of keyboard state
- [x] Add `handleOnly` prop to the Vaul Drawer so only the drag handle triggers dismiss, not form scrolling

## Implementation Notes

- `svh` is the smallest viewport height (accounts for browser chrome but NOT the keyboard)
- The browser natively scrolls focused inputs into view above the keyboard
- `handleOnly` prevents accidental drawer dismissal when users scroll the activity form
