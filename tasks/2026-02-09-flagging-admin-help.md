# 2026-02-09 Activity Flagging & Admin Help

Add user-facing activity flagging and an admin help modal explaining the flagging workflow.

## Tasks

- [x] Add `flagActivity` mutation for users to flag activities from the feed
- [x] Add flag/report button to activity feed cards (3-dot menu with "Report activity")
- [x] Add flag dialog with reason input
- [x] Add admin help modal on flagged-activities page explaining:
  - How flagging works (users report suspicious activities)
  - The state machine: pending -> resolved / reopened
  - What happens when resolved (activity unflagged, participant notified)
  - Admin actions available (comment, edit, resolve)

## Implementation Notes

- Backend: New `flagActivity` mutation in `packages/backend/mutations/activities.ts`
  - Creates flag record in `flags` table
  - Updates activity `flagged`, `flaggedAt`, `flaggedReason` fields
  - Creates audit history entry in `activityFlagHistory`
- Frontend: Report button added to activity card footer via dropdown menu
  - Dialog with textarea for reason
  - Uses `createFlagSchema` validation from `lib/validations.ts`
- Admin help: Info button + dialog on flagged-activities page header
  - Explains the full flagging lifecycle with state diagram
