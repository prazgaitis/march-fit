import { dateOnlyToUtcMs } from "./dateOnly";

/**
 * Get the week number of the challenge for a given date.
 * Week 1 = days 0-6, Week 2 = days 7-13, etc.
 * Returns 0 if the date is before the challenge starts.
 */
export function getChallengeWeekNumber(
  challengeStartDate: string | number,
  loggedDate: number
): number {
  const startDate = new Date(dateOnlyToUtcMs(challengeStartDate));
  const loggedDateObj = new Date(loggedDate);

  const startDayUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );

  const loggedDayUtc = Date.UTC(
    loggedDateObj.getUTCFullYear(),
    loggedDateObj.getUTCMonth(),
    loggedDateObj.getUTCDate()
  );

  const daysSinceStart = Math.floor(
    (loggedDayUtc - startDayUtc) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceStart < 0) {
    return 0;
  }

  return Math.floor(daysSinceStart / 7) + 1;
}

/**
 * Get the UTC timestamp range [start, end) for a given challenge week number.
 * Week 1 covers days 0-6, Week 2 covers days 7-13, etc.
 */
export function getWeekDateRange(
  challengeStartDate: string | number,
  weekNumber: number
): { start: number; end: number } {
  const startMs = dateOnlyToUtcMs(challengeStartDate);
  const startDate = new Date(startMs);
  const startDayUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const weekStart = startDayUtc + (weekNumber - 1) * 7 * msPerDay;
  const weekEnd = weekStart + 7 * msPerDay;

  return { start: weekStart, end: weekEnd };
}

/**
 * Get the total number of weeks in a challenge.
 */
export function getTotalWeeks(durationDays: number): number {
  return Math.ceil(durationDays / 7);
}
