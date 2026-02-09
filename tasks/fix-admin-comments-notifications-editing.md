# Fix admin comments display, notifications, and admin activity editing

**Date:** 2026-02-09
**Description:** Admin comments on flagged activities now display on the activity detail page, notification types are properly handled, success messages are context-aware, and admins can edit activity details directly from the activity page.

## Changes

### 1. Backend: Extend `getById` query to return admin comment + viewer context
- [x] Return `adminComment`, `isOwner`, `isAdmin` from `getById`
- [x] Gate `adminComment` visibility: show if visibility is `"participant"` OR viewer is owner OR viewer is admin

**File:** `packages/backend/queries/activities.ts`

### 2. Backend: Add `activityTypeId` to admin edit mutation
- [x] Add optional `activityTypeId` arg to `adminEditActivity`
- [x] Validate activity type belongs to same challenge
- [x] Track change in history

**File:** `packages/backend/mutations/admin.ts`

### 3. Frontend: Show admin comment on activity detail page
- [x] Display admin comment card with Shield icon when `adminComment` is present
- [x] Styled as amber-tinted alert box

**File:** `apps/web/app/challenges/[id]/activities/[activityId]/activity-detail-content.tsx`

### 4. Frontend: Admin edit controls on activity detail page
- [x] Collapsible "Edit Activity (Admin)" section for admin users
- [x] Fields: activity type dropdown, points, logged date, notes
- [x] Uses existing `adminEditActivity` mutation and `getByChallengeId` query for activity types

**File:** `apps/web/app/challenges/[id]/activities/[activityId]/activity-detail-content.tsx`

### 5. Frontend: Fix notification types
- [x] Added `admin_comment` and `admin_edit` cases with Shield icon
- [x] Proper messages: "An admin left a comment on your activity" / "An admin updated your activity"

**File:** `apps/web/app/challenges/[id]/notifications/notifications-list.tsx`

### 6. Frontend: Fix misleading success message
- [x] Conditional message: "Comment added and participant notified." vs "Internal comment added."

**File:** `apps/web/components/admin/flagged-activity-actions.tsx`

### 7. Integration tests
- [x] 13 tests covering: getById viewer context, admin comment visibility, auth rejection, activity type editing, points adjustment, notifications

**File:** `apps/web/tests/api/admin-activity.test.ts`
