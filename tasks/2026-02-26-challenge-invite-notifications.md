# Challenge Invite Notifications + Notification Audit

**Date:** 2026-02-26
**Description:** Send the inviter a notification when someone joins via their invite link. Audit and fix all other notification sites: comments, likes, and UI type mismatches. Notify admins/creator on join. Rollup duplicate like/comment notifications.

## Changes

### 1. Backend: Invite-join notification in `participations.join`
- [x] When a user joins via invite (invitedByUserId is set), create a notification for the inviter
- [x] Type: `invite_accepted`, data: `{ challengeId, challengeName }`
- [x] Skip if inviter is the same as joiner (self-invite edge case)

**File:** `packages/backend/mutations/participations.ts`

### 2. Backend: Join notifications to admins/creator
- [x] Notify challenge creator with type `join` when someone joins
- [x] Notify challenge-level admins (role=admin) with type `join`
- [x] Skip inviter (already gets `invite_accepted`), skip joiner (no self-notify)

**File:** `packages/backend/mutations/participations.ts`

### 3. Backend: Comment notification in `comments.create`
- [x] Notify the activity owner when someone comments on their activity
- [x] Type: `comment`, data: `{ activityId }`
- [x] Skip self-comments (don't notify if commenter is the activity owner)
- [x] Dedup via rollup helper (same activityId within 1-hour window)

**File:** `packages/backend/mutations/comments.ts`

### 4. Backend: Like notification in `likes.toggle`
- [x] Notify the activity owner when someone likes their activity
- [x] Type: `like`, data: `{ activityId }`
- [x] Skip self-likes
- [x] Only on like, not on unlike
- [x] Dedup via rollup helper (same activityId within 1-hour window)

**File:** `packages/backend/mutations/likes.ts`

### 5. Backend: Notification rollup helper
- [x] `insertNotification()` checks for recent duplicate before inserting
- [x] Applied to `like` and `comment` types
- [x] 1-hour rollup window, matched on (userId, type, data.activityId)

**File:** `packages/backend/lib/notifications.ts`

### 6. Frontend: Update notification type handling in UI
- [x] Add `invite_accepted` type with message "X joined the challenge with your invite link"
- [x] Add `new_follower` case (currently only `follow` is handled, but backend sends `new_follower`)
- [x] Fix notification link for `invite_accepted` and `join` to go to the joiner's profile
- [x] Add `join` link handling using `data.challengeId`

**File:** `apps/web/app/challenges/[id]/notifications/notifications-list.tsx`

### 7. Tests
- [x] 16 tests covering all notification types
- [x] invite_accepted: via code, via userId, no-invite produces join
- [x] join to admins/creator: creator notified, admins notified, no double-notify inviter, no self-notify
- [x] comment: notifies owner, skips self, dedup rollup
- [x] like: notifies owner, skips self, no unlike notify, dedup rollup, different activities not deduped

**File:** `apps/web/tests/api/notifications.test.ts`
