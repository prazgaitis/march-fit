# Challenge Finished State & Winners Display
**Date:** 2026-04-01

## 1. Schema & Backend
- [ ] Add `finishedAt`, `winners` fields to challenges table
- [ ] Add `finishedAt` and `winners` to updateChallenge mutation
- [ ] Block activity logging when challenge is finished (activityLifecycle.ts)

## 2. Admin Panel - Winners Config
- [ ] Admin page to mark challenge as finished and configure winners
- [ ] Support ties (multiple users at same placement)
- [ ] Preview of Winners component in admin panel

## 3. Winners Display Component
- [ ] Reusable Winners component showing placement, name, points
- [ ] Show on leaderboard page (top of page)
- [ ] Show on challenge index route

## 4. Leaderboard Decimals
- [ ] Truncate decimals on leaderboard (show whole numbers)
- [ ] Keep full precision on user profile
