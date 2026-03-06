# Fix Notification Mobile Layout & Comment Like Links

**Date:** 2026-03-05

## Problem

1. On mobile, notifications with action buttons (e.g., "Follow back") have poor text layout - the name and description text gets squeezed and wraps awkwardly when the button takes horizontal space.
2. When someone likes a comment, the notification links to the actor's profile instead of the activity page where the comment lives.

## Implementation Plan

### 1. Fix mobile layout for notifications with actions
- [x] Restructure the notification item layout so the action button sits below the text on mobile rather than competing for horizontal space
- [x] Use flex-wrap or a stacked layout so the "Follow back" button doesn't squeeze the notification text

### 2. Comment like notification should link to the activity
- [x] Update `commentLikes.ts` mutation to include `activityId` in the notification data (looked up from the comment's `activityId` field)
- [x] Update `getNotificationLink` to handle `comment_like` type with `commentId` query param
- [x] Add comment highlight/scroll support on the activity detail page via `?commentId=` URL param

### 3. Tests
- [x] Add test for comment_like notification including activityId in data
- [x] Add unit tests for `getNotificationLink` covering comment_like type
- [x] Add unit tests for `getNotificationMessage` covering all types
