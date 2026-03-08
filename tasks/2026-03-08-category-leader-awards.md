# 2026-03-08 Category Leader Awards

Admin page to preview and apply weekly category leader bonus points.

## Todos
- [x] Add `category_leader` source literal to activities schema
- [x] Create backend query: preview category leader awards for a given week
- [x] Create backend mutation: apply category leader awards for a given week
- [x] Create admin page at `/admin/category-leaders`
- [x] Add nav item to admin layout (Scoring group)
- [x] Typecheck passes

## Implementation Notes

**Schema**: Added `"category_leader"` to the `source` union in `activities` table.

**Backend Query** (`queries/categoryLeaderAwards.ts`):
- `previewWeeklyAwards` — returns #1 leader per leaderboard category for a given week
- Shows which weeks have already been awarded (parses externalId pattern)
- Surfaces tie information (count of tied users)
- Uses `sourceExternalId` index to efficiently find existing awards

**Backend Mutation** (`mutations/categoryLeaderAwards.ts`):
- `applyWeeklyAwards` — awards bonus points to weekly category leaders
- Idempotent via `externalId`: `category_leader_week_{weekNum}_{categoryId}_{userId}`
- Creates "Category Leader Bonus" activity type on first use
- Updates denormalized `userChallenges.totalPoints`
- Uses `insertActivity` which handles feed scoring and aggregation

**Admin Page** (`apps/web/app/challenges/[id]/admin/category-leaders/page.tsx`):
- Week selector with prev/next navigation
- Configurable bonus points (default: 25)
- Preview table showing category, leader, weekly points, and bonus amount
- Applied/current week badges
- Apply button with idempotency protection (disabled if already applied)
- Success result banner
