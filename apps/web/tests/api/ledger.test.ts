import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@repo/backend";
import { dateOnlyToUtcMs } from "@/lib/date-only";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestActivityType,
  createTestChallenge,
  createTestContext,
  createTestParticipation,
  createTestUser,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";

describe("getLedger", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  it("returns null for non-participant", async () => {
    const userId = await createTestUser(t, { email: "ledger-none@example.com" });
    const challengeId = await createTestChallenge(t, userId);

    const result = await t.query(api.queries.users.getLedger, {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    });

    expect(result).toBeNull();
  });

  it("returns empty days when no activities", async () => {
    const userId = await createTestUser(t, { email: "ledger-empty@example.com" });
    const challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);

    const result = await t.query(api.queries.users.getLedger, {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    });

    expect(result).not.toBeNull();
    expect(result!.days).toHaveLength(0);
    expect(result!.totalActivityPoints).toBe(0);
    expect(result!.totalStreakBonus).toBe(0);
  });

  it("groups activities by day and sums correctly", async () => {
    const userId = await createTestUser(t, { email: "ledger-group@example.com" });
    const challengeId = await createTestChallenge(t, userId, {
      streakMinPoints: 10,
    });
    await createTestParticipation(t, userId, challengeId, { totalPoints: 47 });

    const runType = await createTestActivityType(t, challengeId, {
      name: "Run",
      contributesToStreak: true,
    });
    const yogaType = await createTestActivityType(t, challengeId, {
      name: "Yoga",
      contributesToStreak: true,
    });

    await t.run(async (ctx) => {
      // Day 1: two activities, 12 + 15 = 27 pts
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-05"),
        pointsEarned: 12,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: yogaType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-05"),
        pointsEarned: 15,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 1100,
        updatedAt: 1100,
      });
      // Day 2: one activity, 20 pts
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-06"),
        pointsEarned: 20,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 2000,
        updatedAt: 2000,
      });
    });

    const result = await t.query(api.queries.users.getLedger, {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    });

    expect(result).not.toBeNull();

    // Days sorted most recent first
    expect(result!.days).toHaveLength(2);
    expect(result!.days[0].date).toBe("2024-01-06");
    expect(result!.days[1].date).toBe("2024-01-05");

    // Day 1 (Jan 5): 2 activities, 27 pts, streak day 1 bonus = 1
    const jan5 = result!.days[1];
    expect(jan5.activities).toHaveLength(2);
    expect(jan5.activityPoints).toBe(27);
    expect(jan5.streakBonus).toBe(1); // day 1 of streak
    expect(jan5.dayTotal).toBe(28);

    // Day 2 (Jan 6): 1 activity, 20 pts, streak day 2 bonus = 2
    const jan6 = result!.days[0];
    expect(jan6.activities).toHaveLength(1);
    expect(jan6.activityPoints).toBe(20);
    expect(jan6.streakBonus).toBe(2); // day 2 of streak
    expect(jan6.dayTotal).toBe(22);

    // Totals
    expect(result!.totalActivityPoints).toBe(47);
    expect(result!.totalStreakBonus).toBe(3); // 1 + 2
  });

  it("internal consistency: sum of day totals equals grand total", async () => {
    const userId = await createTestUser(t, { email: "ledger-consistency@example.com" });
    const challengeId = await createTestChallenge(t, userId, {
      streakMinPoints: 5,
    });
    await createTestParticipation(t, userId, challengeId, { totalPoints: 60 });

    const runType = await createTestActivityType(t, challengeId, {
      name: "Run",
      contributesToStreak: true,
    });
    const penaltyType = await createTestActivityType(t, challengeId, {
      name: "Drinks",
      contributesToStreak: false,
      isNegative: true,
    });

    await t.run(async (ctx) => {
      // 3 consecutive qualifying days + one negative activity
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-10"),
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-11"),
        pointsEarned: 15,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 2000,
        updatedAt: 2000,
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: penaltyType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-11"),
        pointsEarned: -3,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 2100,
        updatedAt: 2100,
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-12"),
        pointsEarned: 20,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 3000,
        updatedAt: 3000,
      });
    });

    const result = await t.query(api.queries.users.getLedger, {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    });

    expect(result).not.toBeNull();

    // Verify internal consistency: sum of per-day values equals totals
    const sumActivityPoints = result!.days.reduce(
      (sum: number, d: { activityPoints: number }) => sum + d.activityPoints,
      0
    );
    const sumStreakBonus = result!.days.reduce(
      (sum: number, d: { streakBonus: number }) => sum + d.streakBonus,
      0
    );
    const sumDayTotals = result!.days.reduce(
      (sum: number, d: { dayTotal: number }) => sum + d.dayTotal,
      0
    );

    expect(sumActivityPoints).toBe(result!.totalActivityPoints);
    expect(sumStreakBonus).toBe(result!.totalStreakBonus);
    expect(sumDayTotals).toBe(result!.totalActivityPoints + result!.totalStreakBonus);

    // Verify each day's dayTotal = activityPoints + streakBonus
    for (const day of result!.days) {
      expect(day.dayTotal).toBe(day.activityPoints + day.streakBonus);
    }

    // Verify each day's activityPoints = sum of its activities
    for (const day of result!.days) {
      const dayActivitySum = day.activities.reduce(
        (sum: number, a: { pointsEarned: number }) => sum + a.pointsEarned,
        0
      );
      expect(dayActivitySum).toBe(day.activityPoints);
    }
  });

  it("cross-checks with getProfile streak data", async () => {
    const userId = await createTestUser(t, { email: "ledger-cross@example.com" });
    const challengeId = await createTestChallenge(t, userId, {
      streakMinPoints: 10,
    });
    await createTestParticipation(t, userId, challengeId);

    const runType = await createTestActivityType(t, challengeId, {
      name: "Run",
      contributesToStreak: true,
    });

    await t.run(async (ctx) => {
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-05"),
        pointsEarned: 12,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-06"),
        pointsEarned: 20,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 2000,
        updatedAt: 2000,
      });
      // Gap day (Jan 7 skipped)
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-08"),
        pointsEarned: 15,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 3000,
        updatedAt: 3000,
      });
    });

    const [ledger, profile] = await Promise.all([
      t.query(api.queries.users.getLedger, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
      }),
      t.query(api.queries.users.getProfile, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
      }),
    ]);

    expect(ledger).not.toBeNull();
    expect(profile).not.toBeNull();

    // Ledger totalStreakBonus should match profile streakCalendar totalStreakBonusPoints
    expect(ledger!.totalStreakBonus).toBe(
      profile!.streakCalendar.totalStreakBonusPoints
    );

    // Ledger totalActivityPoints should match sum of profile activities
    expect(ledger!.totalActivityPoints).toBe(
      profile!.stats.recentActivities.reduce(
        (sum: number, a: { pointsEarned: number }) => sum + a.pointsEarned,
        0
      )
    );

    // Streak bonus breakdown: day5=1, day6=2, gap, day8=1 → total=4
    expect(ledger!.totalStreakBonus).toBe(4);

    // Verify gap resets streak
    const jan8 = ledger!.days.find(
      (d: { date: string }) => d.date === "2024-01-08"
    );
    expect(jan8!.streakBonus).toBe(1); // reset after gap
  });

  it("non-streak activities do not contribute to streak bonus", async () => {
    const userId = await createTestUser(t, { email: "ledger-nostreak@example.com" });
    const challengeId = await createTestChallenge(t, userId, {
      streakMinPoints: 10,
    });
    await createTestParticipation(t, userId, challengeId);

    const nonStreakType = await createTestActivityType(t, challengeId, {
      name: "Meditation",
      contributesToStreak: false,
    });

    await t.run(async (ctx) => {
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: nonStreakType as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-05"),
        pointsEarned: 20,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      });
    });

    const result = await t.query(api.queries.users.getLedger, {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    });

    expect(result).not.toBeNull();
    expect(result!.days).toHaveLength(1);
    expect(result!.days[0].activityPoints).toBe(20);
    expect(result!.days[0].streakBonus).toBe(0); // non-streak activity
    expect(result!.totalStreakBonus).toBe(0);
  });

  it("does not include activities from other challenges", async () => {
    const userId = await createTestUser(t, { email: "ledger-scope@example.com" });
    const challengeA = await createTestChallenge(t, userId, { name: "Challenge A" });
    const challengeB = await createTestChallenge(t, userId, { name: "Challenge B" });
    await createTestParticipation(t, userId, challengeA);
    await createTestParticipation(t, userId, challengeB);

    const typeA = await createTestActivityType(t, challengeA, { name: "Run A" });
    const typeB = await createTestActivityType(t, challengeB, { name: "Run B" });

    await t.run(async (ctx) => {
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeA as Id<"challenges">,
        activityTypeId: typeA as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-05"),
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 1000,
        updatedAt: 1000,
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeB as Id<"challenges">,
        activityTypeId: typeB as Id<"activityTypes">,
        loggedDate: dateOnlyToUtcMs("2024-01-05"),
        pointsEarned: 99,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        source: "manual",
        createdAt: 2000,
        updatedAt: 2000,
      });
    });

    const result = await t.query(api.queries.users.getLedger, {
      userId: userId as Id<"users">,
      challengeId: challengeA as Id<"challenges">,
    });

    expect(result).not.toBeNull();
    expect(result!.totalActivityPoints).toBe(10);
    expect(result!.days).toHaveLength(1);
    expect(result!.days[0].activities).toHaveLength(1);
  });
});
