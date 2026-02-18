# Add Challenge Forums

**Date:** 2026-02-18

## Overview
Add a forum for each challenge where users can ask questions, share tips, and discuss the challenge. Admins have moderation capabilities (pin, delete). Users can upvote posts. Activity links render as rich cards.

## Data Model

- [x] `forumPosts` table: challengeId, userId, title, content, parentPostId (for replies), isPinned, deletedAt, createdAt, updatedAt
- [x] `forumPostUpvotes` table: postId, userId, createdAt (unique per user+post)

## Backend (Convex)

- [x] Queries: listByChallengeId (paginated, pinned first), getById (with replies, user data, upvote counts)
- [x] Mutations: createPost, updatePost, deletePost, toggleUpvote, togglePin (admin only)

## Frontend

- [x] Forum list page at `/challenges/[id]/forum` - shows posts sorted by pinned first, then newest
- [x] Post detail page at `/challenges/[id]/forum/[postId]` - shows post with replies
- [x] Activity link rich card - detects `/challenges/.../activities/...` links and shows activity preview
- [x] Admin panel page at `/challenges/[id]/admin/forum` - manage posts, pin/unpin, delete
- [x] Navigation link added to challenge sidebar/nav

## Tests

- [x] Backend mutation tests: create, edit, delete, upvote, pin
- [x] Authorization tests: only admins can pin, only authors/admins can edit/delete
- [x] Edge cases: empty content, duplicate upvotes, nested replies
