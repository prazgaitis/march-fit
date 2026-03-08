# 2026-03-08 Category Leader Awards

Admin page to preview and apply weekly category leader bonus points (top 3 placements, escalating by week, plus cumulative).

## Todos
- [x] Add `category_leader` source literal to activities schema
- [x] Create shared lib for placement point calculations
- [x] Create backend query: preview category leader awards (top 3, weekly + cumulative)
- [x] Create backend mutation: apply category leader awards
- [x] Create admin page at `/admin/category-leaders`
- [x] Add nav item to admin layout (Scoring group)
- [x] Typecheck + lint passes

## Point Structure

Multipliers per placement: 1st = 10×, 2nd = 5×, 3rd = 3×

| Period     | 1st | 2nd | 3rd |
|------------|-----|-----|-----|
| Week 1     | 10  | 5   | 3   |
| Week 2     | 20  | 10  | 6   |
| Week 3     | 30  | 15  | 9   |
| Week 4     | 40  | 20  | 12  |
| Cumulative | 50  | 25  | 15  |

## Implementation Notes

**Shared Lib** (`lib/categoryLeaderPoints.ts`):
- Placement multipliers [10, 5, 3], derived from week number
- Cumulative uses (totalWeeks + 1) as multiplier

**Backend Query** (`queries/categoryLeaderAwards.ts`):
- `previewWeeklyAwards` — weekNumber 0 = cumulative, 1+ = weekly
- Returns top 3 per leaderboard category with placement points
- Weekly: reads `weeklyCategoryPoints` table
- Cumulative: reads `categoryPoints` table
- Tracks which weeks have already been applied

**Backend Mutation** (`mutations/categoryLeaderAwards.ts`):
- `applyWeeklyAwards` — awards top 3 per category
- Idempotent via externalId: `category_leader_week_{N}_{catId}_{userId}` or `category_leader_cumulative_{catId}_{userId}`
- Uses existing "Category Leader Bonus" activity type or creates one
- Updates denormalized `userChallenges.totalPoints`

**Admin Page**:
- Week selector: W1–W4 + Cumulative (week 0), with prev/next arrows
- Points reference card showing placement → points for selected week
- Per-category cards with top 3 placements (crown/medal icons, user avatar, category points, bonus)
- Applied/current week badges, applied weeks summary
- Apply button with idempotency protection
