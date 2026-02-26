# Challenge Invite Notifications + Notification Audit

**Date:** 2026-02-26
**Description:** Send the inviter a notification when someone joins via their invite link. Audit and fix all other notification sites: comments, likes, and UI type mismatches.

## Changes

### 1. Backend: Invite-join notification in `participations.join`
- [x] When a user joins via invite (invitedByUserId is set), create a notification for the inviter
- [x] Type: `invite_accepted`, data: `{ challengeId, challengeName }`
- [x] Skip if inviter is the same as joiner (self-invite edge case)

**File:** `packages/backend/mutations/participations.ts`

### 2. Backend: Comment notification in `comments.create`
- [x] Notify the activity owner when someone comments on their activity
- [x] Type: `comment`, data: `{ activityId }`
- [x] Skip self-comments (don't notify if commenter is the activity owner)

**File:** `packages/backend/mutations/comments.ts`

### 3. Backend: Like notification in `likes.toggle`
- [x] Notify the activity owner when someone likes their activity
- [x] Type: `like`, data: `{ activityId }`
- [x] Skip self-likes
- [x] Only on like, not on unlike

**File:** `packages/backend/mutations/likes.ts`

### 4. Frontend: Update notification type handling in UI
- [x] Add `invite_accepted` type with message "X joined the challenge with your invite link"
- [x] Add `new_follower` case (currently only `follow` is handled, but backend sends `new_follower`)
- [x] Fix notification link for `invite_accepted` to go to the challenge page

**File:** `apps/web/app/challenges/[id]/notifications/notifications-list.tsx`
