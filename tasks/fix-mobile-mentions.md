# Fix Mobile Mentions

**Date:** 2026-03-18

## Problem

Mentioning users via `@` in the rich text editor does not work on mobile devices. The mention dropdown appears and shows names correctly, but tapping a name does nothing - the mention is not inserted.

## Root Cause

The `MentionList` component in `rich-text-editor.tsx` only had `onMouseDown` with `preventDefault()` to keep focus on the editor when clicking a mention suggestion. On mobile:

1. `touchstart` fires on the button (no handler to prevent default)
2. The editor loses focus
3. Tiptap detects the blur and closes the mention suggestion popup
4. `onExit()` destroys the tippy popup and React component
5. `touchend`/`click` never fire on the now-destroyed element

## Fix

- [x] Add `onTouchStart={(e) => e.preventDefault()}` to prevent focus loss on touch
- [x] Restore `onTouchEnd` handler to explicitly select the item on touch
- [x] Add `touch: true` to tippy.js config for proper mobile touch support
- [x] Verify types pass
