import { describe, it, expect } from "vitest";
import {
  aggregateDailyStreakPoints,
  computeStreak,
  computeTotalStreakBonus,
  DAY_MS,
} from "../../../../packages/backend/lib/streak";

const day = (offset: number) => Date.UTC(2024, 0, 1) + offset * DAY_MS;

describe("computeStreak", () => {
  it("returns streak 0 for empty input", () => {
    const result = computeStreak(new Map(), 10);
    expect(result.currentStreak).toBe(0);
    expect(result.lastStreakDay).toBeUndefined();
    expect(result.dailyStreakCount.size).toBe(0);
  });

  it("returns streak 1 for a single qualifying day", () => {
    const result = computeStreak(new Map([[day(0), 10]]), 10);
    expect(result.currentStreak).toBe(1);
    expect(result.lastStreakDay).toBe(day(0));
    expect(result.dailyStreakCount.get(day(0))).toBe(1);
  });

  it("returns streak 3 for 3 consecutive qualifying days", () => {
    const daily = new Map([
      [day(0), 15],
      [day(1), 20],
      [day(2), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.currentStreak).toBe(3);
    expect(result.dailyStreakCount.get(day(0))).toBe(1);
    expect(result.dailyStreakCount.get(day(1))).toBe(2);
    expect(result.dailyStreakCount.get(day(2))).toBe(3);
  });

  it("resets streak on gap: days 0,1,3 → currentStreak 1", () => {
    const daily = new Map([
      [day(0), 10],
      [day(1), 10],
      [day(3), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.currentStreak).toBe(1);
    expect(result.dailyStreakCount.get(day(0))).toBe(1);
    expect(result.dailyStreakCount.get(day(1))).toBe(2);
    expect(result.dailyStreakCount.get(day(3))).toBe(1);
  });

  it("below-threshold day breaks streak", () => {
    const daily = new Map([
      [day(0), 10],
      [day(1), 5], // below threshold
      [day(2), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.currentStreak).toBe(1);
    expect(result.dailyStreakCount.get(day(0))).toBe(1);
    expect(result.dailyStreakCount.has(day(1))).toBe(false);
    expect(result.dailyStreakCount.get(day(2))).toBe(1);
  });

  it("currentStreak is the final streak, not the max", () => {
    // streak of 3, gap, then streak of 1
    const daily = new Map([
      [day(0), 10],
      [day(1), 10],
      [day(2), 10],
      [day(5), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.currentStreak).toBe(1);
    expect(result.lastStreakDay).toBe(day(5));
  });

  it("all days below threshold → streak 0", () => {
    const daily = new Map([
      [day(0), 5],
      [day(1), 3],
      [day(2), 9],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.currentStreak).toBe(0);
    expect(result.lastStreakDay).toBeUndefined();
    expect(result.dailyStreakCount.size).toBe(0);
  });

  it("long streak with reset in middle, then new streak at end", () => {
    // 4-day streak, gap, 2-day streak
    const daily = new Map([
      [day(0), 10],
      [day(1), 10],
      [day(2), 10],
      [day(3), 10],
      [day(6), 10],
      [day(7), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.currentStreak).toBe(2);
    expect(result.lastStreakDay).toBe(day(7));
    expect(result.dailyStreakCount.get(day(3))).toBe(4);
    expect(result.dailyStreakCount.get(day(6))).toBe(1);
    expect(result.dailyStreakCount.get(day(7))).toBe(2);
  });
});

describe("aggregateDailyStreakPoints", () => {
  const streakType = "streak-type";
  const nonStreakType = "non-streak-type";
  const contributes = (id: string) => id === streakType;

  it("filters out non-contributing types", () => {
    const activities = [
      { loggedDate: day(0), pointsEarned: 10, activityTypeId: streakType },
      { loggedDate: day(0), pointsEarned: 5, activityTypeId: nonStreakType },
    ];
    const result = aggregateDailyStreakPoints(activities, contributes);
    expect(result.get(day(0))).toBe(10);
  });

  it("groups multiple activities on same day", () => {
    const activities = [
      { loggedDate: day(0), pointsEarned: 10, activityTypeId: streakType },
      { loggedDate: day(0), pointsEarned: 7, activityTypeId: streakType },
      { loggedDate: day(1), pointsEarned: 3, activityTypeId: streakType },
    ];
    const result = aggregateDailyStreakPoints(activities, contributes);
    expect(result.get(day(0))).toBe(17);
    expect(result.get(day(1))).toBe(3);
  });

  it("returns empty map for empty activities", () => {
    const result = aggregateDailyStreakPoints([], contributes);
    expect(result.size).toBe(0);
  });
});

describe("computeTotalStreakBonus", () => {
  it("returns 0 for empty map", () => {
    expect(computeTotalStreakBonus(new Map())).toBe(0);
  });

  it("returns sum for a 3-day streak (1+2+3=6)", () => {
    const map = new Map([
      [day(0), 1],
      [day(1), 2],
      [day(2), 3],
    ]);
    expect(computeTotalStreakBonus(map)).toBe(6);
  });

  it("sums two separate streaks correctly", () => {
    // streak of 2 (1+2) then streak of 1 (1) = 4
    const map = new Map([
      [day(0), 1],
      [day(1), 2],
      [day(5), 1],
    ]);
    expect(computeTotalStreakBonus(map)).toBe(4);
  });
});

describe("computeStreak totalStreakBonus", () => {
  it("returns 0 for empty input", () => {
    const result = computeStreak(new Map(), 10);
    expect(result.totalStreakBonus).toBe(0);
  });

  it("returns 1 for a single qualifying day", () => {
    const result = computeStreak(new Map([[day(0), 10]]), 10);
    expect(result.totalStreakBonus).toBe(1);
  });

  it("returns 6 for 3 consecutive qualifying days (1+2+3)", () => {
    const daily = new Map([
      [day(0), 15],
      [day(1), 20],
      [day(2), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.totalStreakBonus).toBe(6);
  });

  it("resets bonus on gap: days 0,1,3 → 1+2+1=4", () => {
    const daily = new Map([
      [day(0), 10],
      [day(1), 10],
      [day(3), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.totalStreakBonus).toBe(4);
  });

  it("4-day streak + gap + 2-day streak → 10+3=13", () => {
    const daily = new Map([
      [day(0), 10],
      [day(1), 10],
      [day(2), 10],
      [day(3), 10],
      [day(6), 10],
      [day(7), 10],
    ]);
    const result = computeStreak(daily, 10);
    expect(result.totalStreakBonus).toBe(13);
  });
});
