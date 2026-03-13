# Fix Mobile Browser Zoom on Input Focus

**Date:** 2026-03-12

## Problem

Mobile browsers (especially iOS Safari) auto-zoom when focusing input fields with `font-size < 16px`. This causes a disorienting zoom effect when users tap on form inputs in the activity logging dialog.

## Root Causes

1. The viewport meta tag doesn't restrict `maximum-scale`, allowing browser-initiated zoom on input focus
2. `CommandInput` (activity type search) uses `text-sm` (14px) on mobile — triggers auto-zoom
3. `RichTextEditor` (notes field) uses `text-sm` (14px) on mobile — triggers auto-zoom

The main `Input` component already correctly uses `text-base md:text-sm` pattern.

## Changes

- [x] Add `maximumScale: 1` to viewport config in `apps/web/app/layout.tsx`
- [x] Update `CommandInput` to use `text-base md:text-sm` pattern in `apps/web/components/ui/command.tsx`
- [x] Update `RichTextEditor` editor props to use `text-base md:text-sm` in `apps/web/components/editor/rich-text-editor.tsx`
