# Edit/Delete Comments & Forum Posts

**Date:** 2026-03-30
**Request:** Cougar Oswald feedback — add edit/delete functionality for comments and forum posts.

## Backend

- [x] Add `update` mutation to `comments.ts` (author can edit their own activity comments)
- [x] Add `remove` mutation to `comments.ts` (author can soft-delete their own activity comments)
- [x] Return `isAuthor` flag from comment queries so frontend knows who can edit/delete
- [x] Return `isAuthor` per reply in forum post `getById` query

## Frontend

- [x] Add edit/delete UI for activity comments in `activity-feed.tsx`
- [x] Add edit UI for forum posts (top-level) in `forum-post-detail.tsx`
- [x] Add edit UI for forum post replies in `forum-post-detail.tsx`
- [x] Fix reply delete authorization (currently checks `data.isAuthor` which is the main post author, not the reply author)
