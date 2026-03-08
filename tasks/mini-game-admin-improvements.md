# Mini-Game Admin Improvements
**Date:** 2026-03-08

## Changes

- [x] Fix `category_leader` type error — add to schema source union
- [x] Allow updating `endsAt` on active mini-games (start date, name, config remain locked)
- [x] Filter unpaid users from mini-game start (checks `challengePaymentConfig`)
- [x] Add `cancel` mutation for active mini-games (deletes participants + game, no points awarded)
- [x] Add Cancel Game button to admin mini-game detail page
- [x] Add `leave` mutation for users to self-remove from a challenge (soft-delete via `leftAt`)
- [x] Add `removeParticipant` mutation for admins (soft-delete via `leftAt`)
- [x] Add Remove button to admin participants page
- [x] Filter `leftAt` users from leaderboards, participant queries, and mini-game start

## Implementation Notes

- `leftAt` field added to `userChallenges` schema (optional number) for soft-delete
- Challenge creator cannot leave or be removed
- Active mini-games can only have `endsAt` changed (pairings are locked)
- `cancelMiniGameForUser` internal mutation added for HTTP API access
- Preview queries use `getLeaderboard()` which also filters `leftAt` users
