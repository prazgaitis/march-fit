# Challenge Invite Links

**Date:** 2026-02-09
**Description:** Users get a personal invite link after joining a challenge that they can share with friends. Track who invited whom, auto-create follow relationships, and pin an invite card to the feed until the challenge starts.

## Requirements

- [x] Add `challengeInvites` table to persist invite codes per user per challenge
- [x] Backend mutation to generate/get an invite code when user is a participant
- [x] Backend query to resolve an invite code to the inviter and challenge
- [x] Update `join` mutation to accept `inviteCode`, record `invitedByUserId`, and auto-follow (both directions)
- [x] Frontend invite accept page at `/challenges/[id]/invite/[code]`
- [x] `InviteCard` component shown above the feed until challenge starts
- [x] Share via Web Share API or clipboard copy

## Implementation Notes

### Schema
- New `challengeInvites` table: `{ challengeId, userId, code }` with index on `code` and composite `(userId, challengeId)`.

### Invite Code Generation
- Short random alphanumeric code (8 chars) generated on first request per user per challenge.
- Idempotent: returns existing code if one exists.

### Join Flow with Invite
- `/challenges/[id]/invite/[code]` page resolves the invite and shows challenge info + join button.
- On join: `invitedByUserId` is set from the invite code's owner.
- Auto-create mutual follow (inviter follows invitee and invitee follows inviter).

### Invite Card in Feed
- Pinned above the activity feed when `now < challenge.startDate`.
- Shows the user's invite link with copy/share buttons.
- Dismissed once challenge starts (no dismiss button needed - it auto-hides).
