# Fix Negative Points UI and Scoring

**Date:** 2026-02-20

## Issues

### UI Issues
- [x] Score estimator in log activity modal doesn't negate points for negative activity types
- [x] Success modal after logging always shows green + "+" prefix (should be red with "-" for negatives)
- [x] Activity detail page doesn't visually indicate negative points (shows raw number, no color/sign)
- [x] Activity feed doesn't differentiate negative points (missing isNegative in feed type + no color)
- [x] Points preview in log dialog doesn't show negative estimate

### Backend Issues
- [x] Feed query (`getChallengeFeed`) doesn't return `isNegative` on activityType
- [x] `rescoreStrava.ts` line 69: `if (newPoints > 0)` skips negative activities during rescoring

## Implementation Notes

### Feed query fix
Added `isNegative` to activityType in `getChallengeFeed` query response (line 249).

### Activity log dialog fixes
- Score estimator: negates estimated points when `selectedActivityType.isNegative`
- Points preview: shows "penalty" wording and red styling for negatives
- Success modal: red styling + no "+" prefix for negative points

### Activity feed fix
- Added `isNegative` to `ActivityFeedItem.activityType` interface
- Points display: red for negatives, shows sign

### Activity detail fix
- Points card: red styling for negative points, shows sign

### Rescore Strava fix
- Changed `if (newPoints > 0)` to `if (newPoints !== 0)` to include negative activities
