# Fix Mobile More Menu

**Date:** 2026-03-15
**Description:** Replace the small dropdown menu on the mobile nav "More" button with a bottom drawer for better tap targets.

## Changes

- [x] Replace `DropdownMenu` with `Drawer` (vaul) component in `mobile-nav.tsx`
- [x] Extract `MoreDrawer` subcomponent with larger, easier-to-tap navigation links
- [x] Use existing `Drawer` component from `@/components/ui/drawer`
- [x] Verify typecheck passes

## Implementation Notes

The mobile nav's "More" button previously used a `DropdownMenu` (Radix) which rendered a small popover with tiny touch targets. This was replaced with the project's existing `Drawer` component (vaul) which slides up from the bottom as a sheet, providing much larger and easier-to-tap navigation items. Each item now has `py-3` padding and `text-base` sizing for comfortable mobile interaction.
