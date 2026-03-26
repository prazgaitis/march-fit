# Badges for Achievements

**Date:** 2026-03-25

Users can earn visual badges that appear next to their avatar. Badges can be linked to achievements (auto-awarded) or manually awarded/removed by admins.

## Schema
- [x] Add `badges` table (challengeId, name, description, imagePublicId, icon, achievementId, timestamps)
- [x] Add `userBadges` table (challengeId, userId, badgeId, awardedAt, awardedBy)

## Backend
- [x] Badge mutations: createBadge, updateBadge, deleteBadge, awardBadge, removeBadge
- [x] Badge queries: getByChallengeId, getUserBadges, getAwardedByChallenge
- [x] Auto-award badges when linked achievement is earned (activities.ts hook)
- [x] Include latestBadge in leaderboard query (getFullLeaderboard)
- [x] Include latestBadge in profile query (getProfile)

## Frontend
- [x] UserAvatar badge overlay (bottom-right corner, scales with size)
- [x] Leaderboard: pass latestBadge to UserAvatar
- [x] Profile: show latestBadge on avatar + BadgesSection with all earned badges
- [x] Admin badges page: CRUD for badge definitions, icon picker, image upload, achievement linking
- [x] Admin badges page: award/remove badges from users
- [x] Admin nav link in Engage group
