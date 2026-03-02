# 2026-03-02 Fix Overindulgence Media Bonus Score

Bug: When logging an Overindulgence penalty with a photo, the media bonus (+1) is added to the base points *before* the negative sign is applied, resulting in -11 instead of -9.

## Root Cause

In `calculateFinalActivityScore()`, the formula is:

```
pointsEarned = applyActivityPointSign(basePoints + bonusPoints, isNegative)
```

For Overindulgence (isNegative=true) with a photo:
- basePoints = 10, bonusPoints = 1
- applyActivityPointSign(11, true) = -11

The media bonus should offset the penalty, not amplify it.

## Fix

- [x] Apply the negative sign only to `basePoints`, then add bonuses separately
- [x] Updated formula: `applyActivityPointSign(basePoints, isNegative) + bonusPoints`
- [x] Tests pass
