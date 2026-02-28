# 2026-02-28 Invite Tracking & Leaderboard

Show how many people a user invited on their profile page, with a modal to view the list. Add an unlinked invite leaderboard page.

## Implementation

- [x] Add `inviteCount` (optional number) to `userChallenges` schema
- [x] Update `join` mutation to increment inviter's `inviteCount` on their userChallenge
- [x] Add `inviteCount` to `getProfile` query return
- [x] Add `getInvitedUsers` query (uses `invitedByUserId` index, filtered by challenge)
- [x] Add `getInviteLeaderboard` query (reads from denormalized `inviteCount`)
- [x] Show invite count on profile page next to followers/following (clickable)
- [x] Add modal showing list of invited users with avatars and join timestamps
- [x] Create `/challenges/[id]/leaderboard-by-invite` page (unlinked, inside dashboard layout)

## Notes

- `inviteCount` is stored on `userChallenges` to avoid counting queries on every profile view
- The invited users modal only loads its query when opened (uses `"skip"`)
- The leaderboard page uses the same dashboard layout for auth but is not linked from navigation
- Existing invites before this change won't be reflected in `inviteCount` — a backfill could be run if needed
