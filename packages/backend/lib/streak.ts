export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Filter activities to streak-contributing types and group pointsEarned by loggedDate.
 * `loggedDate` is already a date-only value (UTC ms for midnight of the local date).
 */
export function aggregateDailyStreakPoints(
  activities: { loggedDate: number; pointsEarned: number; activityTypeId: string }[],
  contributesToStreak: (activityTypeId: string) => boolean,
): Map<number, number> {
  const dailyPoints = new Map<number, number>();
  for (const act of activities) {
    if (!contributesToStreak(act.activityTypeId)) continue;
    dailyPoints.set(act.loggedDate, (dailyPoints.get(act.loggedDate) ?? 0) + act.pointsEarned);
  }
  return dailyPoints;
}

export interface StreakResult {
  currentStreak: number;
  lastStreakDay: number | undefined;
  /** dateOnlyMs → running streak count on that day */
  dailyStreakCount: Map<number, number>;
  /** Sum of all daily streak counts (each day's bonus = its running streak count) */
  totalStreakBonus: number;
}

/**
 * Sum all values in a dailyStreakCount map.
 * Each value is the running streak count for that day, which equals the bonus for that day.
 */
export function computeTotalStreakBonus(dailyStreakCount: Map<number, number>): number {
  let total = 0;
  for (const count of dailyStreakCount.values()) {
    total += count;
  }
  return total;
}

/**
 * Compute streak from daily points map.
 * Keys are dateOnlyMs values; consecutive days differ by exactly DAY_MS.
 * A day qualifies if its points >= streakMinPoints.
 * A gap (or below-threshold day) resets the streak to 0.
 */
export function computeStreak(
  dailyPoints: Map<number, number>,
  streakMinPoints: number,
): StreakResult {
  const qualifyingDays = Array.from(dailyPoints.entries())
    .filter(([, points]) => points >= streakMinPoints)
    .map(([dayMs]) => dayMs)
    .sort((a, b) => a - b);

  if (qualifyingDays.length === 0) {
    return { currentStreak: 0, lastStreakDay: undefined, dailyStreakCount: new Map(), totalStreakBonus: 0 };
  }

  const dailyStreakCount = new Map<number, number>();
  let currentStreak = 1;
  dailyStreakCount.set(qualifyingDays[0], 1);

  for (let i = 1; i < qualifyingDays.length; i++) {
    const prev = qualifyingDays[i - 1];
    const curr = qualifyingDays[i];
    if (curr - prev === DAY_MS) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    dailyStreakCount.set(curr, currentStreak);
  }

  return {
    currentStreak,
    lastStreakDay: qualifyingDays[qualifyingDays.length - 1],
    dailyStreakCount,
    totalStreakBonus: computeTotalStreakBonus(dailyStreakCount),
  };
}
