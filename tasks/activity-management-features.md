# Activity Management Features

**Date:** 2026-03-22

## Overview
Admin activity management improvements: delete activities, create activities for users, and show 4th/5th place in category leaders.

## Tasks

- [x] Admin delete activity — Add delete button to flagged activity detail view with confirmation
- [x] Admin create activity page — New admin page to log activities on behalf of users
- [x] Category leaders 4th/5th — Show 4th and 5th place entries with muted styling, no bonus points awarded

## Implementation Notes

### Admin Delete Activity
- Created `adminDeleteActivity` mutation in `packages/backend/mutations/admin.ts`
- Added delete button with confirmation dialog to `flagged-activity-actions.tsx`

### Admin Create Activity Page
- New page at `/challenges/[id]/admin/activities/page.tsx`
- Uses `adminLogActivityForUser` mutation
- Added "Log Activity" nav item to admin layout under Monitor group

### Category Leaders 4th/5th
- Updated `previewWeeklyAwards` query to return top 5 instead of top 3
- Updated admin category leaders page to render 4th/5th with muted styling
- 4th/5th entries show stats but have `bonusPoints: 0` — no points awarded
