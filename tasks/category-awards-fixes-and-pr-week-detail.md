# Category Awards Fixes & PR Week Detail
**Date:** 2026-04-01

Admin-reported issues with March Fitness 2026 end-of-challenge awards.

## 1. Fix Swimming Category Flag
- [x] Create one-off action to set `showInCategoryLeaderboard: false` on Swimming category in prod
- Swimming was incorrectly included when cumulative awards were applied

## 2. Gender-Split Cumulative Awards
- [x] Update `applyWeeklyAwards` mutation to split by gender for cumulative (week 0)
- [x] Update `previewWeeklyAwards` query to show gender-split preview for cumulative
- [x] Update `revokeWeeklyAwards` to handle gender-split awards
- Award structure: 50/25/15 pts for top 3 women AND top 3 men/open per category
- Categories: run, high cardio, low cardio, cycling, yoga, rowing (NOT swimming)

## 3. PR Week Bonus Activity Detail
- [x] Enhance `calculatePrWeekOutcomes` to capture activity breakdown on PR day
- [x] Include activity names and point totals in the bonus activity notes
- No data migration needed — admin can revoke and reapply

## 4. Lindsay Barnes Lo-Intensity Fix
- [ ] Investigate and fix her `totalMetricValue` in categoryPoints/weeklyCategoryPoints
- She was audited to reduce points but minutes still show, affecting category leader rankings
