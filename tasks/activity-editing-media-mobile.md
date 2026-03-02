# Activity Editing: Rich Edit, Media After Posting, Mobile

**Date:** 2026-03-02

Users should be able to edit activities more richly, add media after posting, and all layouts should work well on mobile.

## Changes

### Backend
- [x] Add `mediaIds` parameter to `editActivity` mutation
- [x] Update media bonus calculation to use new/updated mediaIds

### Frontend – Edit Dialog
- [x] Switch from plain `Dialog` to `ResponsiveDialog` (drawer on mobile, dialog on desktop)
- [x] Add media upload section: show existing media, add new, remove existing
- [x] Switch notes from plain `Textarea` to `RichTextEditor` with mentions
- [x] Ensure all layouts work well on mobile (full-width buttons, scrollable body, etc.)

## Implementation Notes

- Existing media is loaded from `activityData.mediaUrls` (resolved URLs) and `activity.mediaIds` (storage IDs)
- New media uses same upload flow as creation: `generateUploadUrl` → POST → storageId
- Media bonus recalculation handles adding/removing media properly, respecting daily cap
- `ResponsiveDialog` renders as bottom-sheet Drawer on mobile, centered Dialog on desktop
