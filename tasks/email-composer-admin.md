# Email Composer Admin Redesign

**Date:** 2026-02-11
**Description:** Replace the existing email admin page with a dedicated email composer experience that supports drafting, previewing, test sending, and bulk sending with localStorage persistence.

## Requirements

- [x] Full compose experience with subject/body editing and live preview
- [x] Tabbed interface: Edit mode and Preview mode
- [x] Preview renders email inside the branded March Fitness email template
- [x] localStorage auto-save for draft persistence across page reloads
- [x] Send to one participant (test send)
- [x] Send to all participants
- [x] Manage existing email sequences (list, create, edit, delete)
- [x] Available templates sidebar

## Implementation Notes

- Reuses existing Convex backend mutations/queries (no backend changes needed)
- localStorage key scoped per challenge + email sequence ID
- Preview uses iframe with the branded email template wrapper
- Draft state auto-saves on every change with debounce
