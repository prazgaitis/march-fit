# Improve Flagged Activity Review

**Date:** 2026-03-12
**Description:** Overhaul the admin flagged activity detail page to provide full context for efficient review.

## Problem

The flagged activity detail page was missing critical context needed for efficient review:
- No activity images/media
- No activity notes displayed in context
- No information about who flagged the activity
- No metrics or bonus breakdown
- No link to the actual activity
- Page was server-rendered (no real-time updates during review)

## Changes

### Backend (`packages/backend/queries/admin.ts`)

- [x] Updated `getFlaggedActivityDetail` to return media URLs (resolved from `mediaIds`)
- [x] Added `cloudinaryPublicIds` for optimized media
- [x] Added `flaggers` array with full flagger user info (name, avatar, reason, timestamp)
- [x] Added `commentCount` for regular activity comments
- [x] Added `triggeredBonuses`, `localTime`, `timezone`, location fields
- [x] Added `scoringConfig` and `isNegative` from activity type
- [x] Used `Promise.all` for parallel data fetching

### Frontend (`apps/web/app/challenges/[id]/admin/flagged-activities/[activityId]/`)

- [x] Created `flagged-activity-detail-content.tsx` — new client component with real-time Convex query
- [x] Updated `page.tsx` to thin server wrapper (auth check only) delegating to client component
- [x] Flag alert banner showing flag reason, timestamp, and individual flaggers with avatars
- [x] Full activity card with: participant avatar, activity type, points, date, created time
- [x] Media gallery (photos/videos) using existing `MediaGallery` component
- [x] Rich text notes display via `RichTextViewer`
- [x] Metrics grid and bonus breakdown
- [x] Location/time context when available
- [x] Link to view the actual activity in the dashboard
- [x] Regular comment count with link to view on activity page
- [x] External ID display for Strava activities
- [x] Admin comments, actions, and history in dedicated cards

## Implementation Notes

- Converted from server component to client component for real-time reactivity during review
- Server-side page.tsx still handles auth gate (admin check) before rendering
- Reused existing components: `MediaGallery`, `RichTextViewer`, `UserAvatar`, `PointsDisplay`
- Backend query now fetches flags table records to surface individual flagger identities
