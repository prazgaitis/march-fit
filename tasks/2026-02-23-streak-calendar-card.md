# Streak Calendar Card on User Profile

**Date:** 2026-02-23
**Description:** Add a visual streak calendar grid to the user profile page showing daily streak-contributing points.

## Changes

### Backend: Add `streakCalendar` to `getProfile` response
- [x] Loop `challengeActivities` filtered to `contributesToStreak` types
- [x] Group `pointsEarned` by `formatDateOnlyFromUtcMs(loggedDate)` into `dailyStreakPoints`
- [x] Return `streakCalendar` object with `startDate`, `endDate`, `streakMinPoints`, `dailyPoints`
- [x] No new DB reads — reuses existing data

### New component: `StreakCalendarCard`
- [x] Created `apps/web/components/streak-calendar-card.tsx`
- [x] Compact weekly grid (Mon–Sun) from challenge start to end
- [x] Cell styling: no activity (`bg-muted/30`), below threshold (`bg-orange-500/20`), meets streak (`bg-orange-500`)
- [x] Tooltip on hover with date + points
- [x] Legend explaining colors and threshold
- [x] Today ring indicator

### Wire into profile page
- [x] Import and render `StreakCalendarCard` after stats grid, before PR Day card
- [x] Gated on `participation && streakCalendar`
