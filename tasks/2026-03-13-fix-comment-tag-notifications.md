# Fix Comment Tag Notifications

**Date:** 2026-03-13
**Description:** @mentions in activity comments were not triggering notifications in the notification feed.

## Root Cause

The `comments.create` mutation notified the activity owner but did not extract `@mention` nodes from the Tiptap JSON content. The forum posts module already had this working via `extractMentionedUserIds` + a scheduled internal mutation, but comments never implemented the same pattern.

## Changes

- [x] Import `extractMentionedUserIds` and `internal` in `packages/backend/mutations/comments.ts`
- [x] After creating a comment, extract mentioned user IDs from Tiptap content and schedule `sendCommentMentionNotifications`
- [x] Add `sendCommentMentionNotifications` internal mutation (skips self-mentions and non-existent users)
- [x] Add `comment_mention` notification type to frontend icon map, message generator, and link handler
- [x] Deep-link comment mention notifications to the specific comment on the activity page

## Files Modified

- `packages/backend/mutations/comments.ts` — mention extraction + internal mutation
- `apps/web/app/challenges/[id]/(dashboard)/notifications/notifications-list.tsx` — UI for `comment_mention` type
