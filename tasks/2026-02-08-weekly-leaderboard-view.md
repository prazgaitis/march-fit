# Weekly Leaderboard View

**Date:** 2026-02-08
**Description:** Add a weekly category leaderboard view to the existing leaderboard page, allowing users to see top performers per activity category for each week of the challenge.

## Requirements

- [x] Add toggle on leaderboard page to switch between "Overall" and "Weekly" views
- [x] Weekly view shows category leaders grouped by category
- [x] Week selector to navigate between weeks (defaults to current week)
- [x] Efficient backend query using `challengeLoggedDate` index for date-range filtering
- [x] Real-time updates via Convex live query on the weekly view

## Implementation Notes

### Backend
- Shared week utility (`packages/backend/lib/weeks.ts`) for week number calculation
- New query `getWeeklyCategoryLeaderboard` in `queries/participations.ts`
  - Uses `challengeLoggedDate` index to efficiently query activities within a week's date range
  - Groups activities by category, then by user, summing points
  - Returns top 10 users per category with user data

### Frontend
- `LeaderboardTabs` client component wraps overall and weekly views
- `WeeklyCategoryLeaderboard` client component with week navigation and category sections
- Uses Convex `useQuery` for real-time weekly data
- Reuses existing `LeaderboardList` for the overall tab
