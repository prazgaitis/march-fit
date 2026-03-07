# Instagram-Style Likes

**Date:** 2026-03-06
**Description:** Update activity likes to behave like Instagram — show "liked by A, B, and N others" text, tapping reveals full list of likers in a mobile-friendly drawer.

## Implementation

- [x] Add `getLikers` query to backend (`packages/backend/queries/likes.ts`)
- [x] Return `recentLikers` (first 2 users) from feed queries alongside `likes` count
- [x] Build `LikesDisplay` component with Instagram-style summary text
- [x] Add a `ResponsiveDialog` (drawer on mobile) to show all likers
- [x] Integrate into `activity-feed.tsx` (feed cards) and `activity-detail-content.tsx`
- [x] Typecheck, lint, and push
