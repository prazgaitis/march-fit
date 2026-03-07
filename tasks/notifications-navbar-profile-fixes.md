# Notifications, Navbar & Profile Fixes

**Date:** 2026-03-06

## Mini-Game Activity Notifications

- [x] During partner week, notify your partner when you log an activity
- [x] During hunt week, notify both your hunter and prey when you log an activity
- [x] Add new notification types: `mini_game_partner_activity`, `mini_game_hunter_activity`, `mini_game_prey_activity`
- [x] Add notification icons (Users for partner, Swords for hunt)
- [x] Add rollup dedup by actor to avoid notification spam (1-hour window)
- [x] Notifications link to the logged activity

**Implementation notes:**
- Added `notifyMiniGameParticipants()` helper in `mutations/activities.ts` that runs after activity logging
- Queries active mini-games for the challenge, finds user's participation record, and notifies relevant parties
- Partner week: notifies partner (skips self-paired middle person)
- Hunt week: notifies both prey and hunter
- Dedup uses actor-based matching for mini-game types (different from activity-based for likes/comments)

## Mobile Navbar Spacing

- [x] Changed from `flex justify-around` with `px-4` padding to `grid grid-cols-5`
- [x] Removed horizontal padding from nav items so they take equal space

**Implementation notes:**
- Switched to CSS Grid with 5 equal columns so all items get identical width regardless of label length
- Center button wrapped in a div to center within its grid cell

## User Profile Page Card Removal

- [x] Remove Card wrappers from user info section
- [x] Replace stats grid (4 Cards) with a compact 4-column stat row with dividers
- [x] Remove Card wrapper from Strava connect section
- [x] Remove Card wrapper from PR Day section
- [x] Remove Card wrapper from participation info
- [x] Replace Recent Activities Card with flat feed-style activity list
- [x] Add ChevronRight indicators on activity rows
- [x] Add "View all" link in header instead of button at bottom
- [x] Use border-b dividers between sections for visual separation

**Implementation notes:**
- Followed the same flat/borderless pattern used in the activity detail page
- Stats row uses `grid grid-cols-4 divide-x` for compact, mobile-friendly display
- Recent activities use flat rows with hover states instead of bordered cards
- StreakCalendarCard and AchievementsSection kept their Card wrappers (they're self-contained components)
