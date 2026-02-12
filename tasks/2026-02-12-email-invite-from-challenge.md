# Email Invite Participants from Previous Challenge

**Date:** 2026-02-12
**Description:** Add ability to send invite emails to participants from a previous challenge via the admin email panel.

## Requirements

- [x] Backend query to list all challenges with participant counts (for challenge picker)
- [x] Backend query to get participants from a source challenge with "already sent" status
- [x] Backend mutation to send email to a list of specific user IDs
- [x] Modal UI in admin emails page: pick challenge, select participants, send
- [x] Select all / deselect all capability
- [x] Search/filter participants in the modal
- [x] Success toast with sent count after bulk send

## Implementation Notes

- New query `listChallengesForImport` in emailSequences queries - returns all challenges sorted by start date with participant counts, excluding the current challenge
- New query `getOtherChallengeParticipants` in emailSequences queries - given an emailSequenceId and source challengeId, returns participants with user info and whether they've already been sent this email
- New mutation `sendToUsers` in emailSequences mutations - sends an email to a specific list of user IDs, creates emailSends records, returns sent/skipped/failed counts
- Two-step modal: step 1 picks challenge, step 2 shows selectable participant list
- Reuses existing dark theme and UI patterns from the email admin page
