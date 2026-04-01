import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import { createTestContext, createTestUser } from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import { insertTestActivity } from "../helpers/activities";
import { extractActivityMetricValue } from "../../../../packages/backend/lib/scoring";

/**
 * Tests that category leaders are ranked by raw metric values (e.g., miles)
 * rather than total points (which include bonuses like marathon bonus).
 *
 * Scenario: User A runs 30mi (300 base pts), User B runs a marathon
 * 26.2mi (262 base pts + 100 bonus = 362 pts). User A should lead
 * because 30 > 26.2 miles.
 */
describe("category leaders ranked by metrics", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  const setupChallenge = async () => {
    const userId = await createTestUser(t, {
      email: "creator@test.com",
      name: "Creator",
    });
    const challengeId = await t.run(async (ctx) => {
      return ctx.db.insert("challenges", {
        name: "Test Challenge",
        creatorId: userId,
        startDate: "2024-01-01",
        endDate: "2024-01-28",
        durationDays: 28,
        streakMinPoints: 10,
        weekCalcMethod: "fromStart",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    return { creatorId: userId, challengeId };
  };

  const createCategory = async (name: string) => {
    return t.run(async (ctx) => {
      return ctx.db.insert("categories", {
        name,
        showInCategoryLeaderboard: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  const createRunningActivityType = async (
    challengeId: Id<"challenges">,
    categoryId: Id<"categories">
  ) => {
    return t.run(async (ctx) => {
      return ctx.db.insert("activityTypes", {
        challengeId,
        name: "Running",
        categoryId,
        scoringConfig: { unit: "miles", pointsPerUnit: 10, basePoints: 0 },
        bonusThresholds: [
          {
            metric: "distance_miles",
            threshold: 26.2,
            bonusPoints: 100,
            description: "Marathon bonus",
          },
        ],
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  const createParticipant = async (
    challengeId: Id<"challenges">,
    email: string,
    name: string
  ) => {
    const userId = await createTestUser(t, {
      email,
      name,
      username: email.split("@")[0],
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("userChallenges", {
        userId,
        challengeId,
        joinedAt: Date.now(),
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        updatedAt: Date.now(),
      });
    });
    return userId;
  };

  /**
   * Insert an activity and maintain both categoryPoints and weeklyCategoryPoints
   * aggregation with totalMetricValue, mirroring the production write path.
   */
  const insertActivityWithMetrics = async (
    userId: Id<"users">,
    challengeId: Id<"challenges">,
    activityTypeId: Id<"activityTypes">,
    loggedDate: number,
    pointsEarned: number,
    metrics: Record<string, unknown>
  ) => {
    return t.run(async (ctx) => {
      const activityId = await insertTestActivity(ctx, {
        userId,
        challengeId,
        activityTypeId,
        loggedDate,
        metrics,
        source: "manual",
        pointsEarned,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Maintain categoryPoints + weeklyCategoryPoints aggregation
      const activityType = await ctx.db.get(activityTypeId);
      const categoryId = activityType?.categoryId;
      if (categoryId) {
        const metricValue = extractActivityMetricValue(
          activityType!,
          metrics
        );

        // Cumulative
        const existing = await ctx.db
          .query("categoryPoints")
          .withIndex("challengeUserCategory", (q: any) =>
            q
              .eq("challengeId", challengeId)
              .eq("userId", userId)
              .eq("categoryId", categoryId)
          )
          .first();
        if (existing) {
          await ctx.db.patch(existing._id, {
            totalPoints: existing.totalPoints + pointsEarned,
            totalMetricValue:
              (existing.totalMetricValue ?? 0) + metricValue,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("categoryPoints", {
            challengeId,
            userId,
            categoryId,
            totalPoints: pointsEarned,
            totalMetricValue: metricValue,
            updatedAt: Date.now(),
          });
        }

        // Weekly
        // Week 1 for Jan 1-7 activities with startDate "2024-01-01"
        const weekExisting = await ctx.db
          .query("weeklyCategoryPoints")
          .withIndex("challengeUserCategoryWeek", (q: any) =>
            q
              .eq("challengeId", challengeId)
              .eq("userId", userId)
              .eq("categoryId", categoryId)
              .eq("weekNumber", 1)
          )
          .first();
        if (weekExisting) {
          await ctx.db.patch(weekExisting._id, {
            totalPoints: weekExisting.totalPoints + pointsEarned,
            totalMetricValue:
              (weekExisting.totalMetricValue ?? 0) + metricValue,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("weeklyCategoryPoints", {
            challengeId,
            userId,
            categoryId,
            weekNumber: 1,
            totalPoints: pointsEarned,
            totalMetricValue: metricValue,
            updatedAt: Date.now(),
          });
        }
      }

      return activityId;
    });
  };

  it("ranks by raw miles, not points (marathon bonus should not affect ranking)", async () => {
    const { challengeId } = await setupChallenge();
    const cardioCategory = await createCategory("Cardio");
    const runningType = await createRunningActivityType(
      challengeId,
      cardioCategory
    );

    const alice = await createParticipant(
      challengeId,
      "alice@test.com",
      "Alice"
    );
    const bob = await createParticipant(
      challengeId,
      "bob@test.com",
      "Bob"
    );

    // Alice: 30mi total across multiple runs (300 base pts, no bonuses)
    await insertActivityWithMetrics(
      alice,
      challengeId,
      runningType,
      Date.UTC(2024, 0, 2),
      150, // 15mi * 10 pts/mi
      { miles: 15 }
    );
    await insertActivityWithMetrics(
      alice,
      challengeId,
      runningType,
      Date.UTC(2024, 0, 3),
      150, // 15mi * 10 pts/mi
      { miles: 15 }
    );

    // Bob: marathon 26.2mi (262 base + 100 marathon bonus = 362 pts)
    await insertActivityWithMetrics(
      bob,
      challengeId,
      runningType,
      Date.UTC(2024, 0, 2),
      362, // 262 base + 100 marathon bonus
      { miles: 26.2 }
    );

    // Preview cumulative awards (weekNumber 0)
    const result = await t.query(
      api.queries.categoryLeaderAwards.previewWeeklyAwards,
      { challengeId, weekNumber: 0 }
    );

    expect(result).not.toBeNull();
    const cardioAward = result!.awards.find(
      (a: any) => a.category.name === "Cardio"
    );
    expect(cardioAward).toBeDefined();

    // Cumulative uses gender-split divisions; test users have no gender → "open"
    const openDivision = cardioAward!.divisions.find(
      (d: any) => d.division === "open"
    );
    expect(openDivision).toBeDefined();

    // Alice should be #1 (30mi > 26.2mi) despite having fewer total points
    expect(openDivision!.placements[0].user.name).toBe("Alice");
    expect(openDivision!.placements[0].totalMetricValue).toBe(30);

    expect(openDivision!.placements[1].user.name).toBe("Bob");
    expect(openDivision!.placements[1].totalMetricValue).toBe(26.2);
  });

  it("also ranks weekly awards by metrics", async () => {
    const { challengeId } = await setupChallenge();
    const cardioCategory = await createCategory("Cardio");
    const runningType = await createRunningActivityType(
      challengeId,
      cardioCategory
    );

    const alice = await createParticipant(
      challengeId,
      "alice@test.com",
      "Alice"
    );
    const bob = await createParticipant(
      challengeId,
      "bob@test.com",
      "Bob"
    );

    // Alice: 10mi (100 pts)
    await insertActivityWithMetrics(
      alice,
      challengeId,
      runningType,
      Date.UTC(2024, 0, 2),
      100,
      { miles: 10 }
    );

    // Bob: 8mi but with bonus for some reason giving him more points
    await insertActivityWithMetrics(
      bob,
      challengeId,
      runningType,
      Date.UTC(2024, 0, 2),
      180, // inflated points (80 base + 100 bonus)
      { miles: 8 }
    );

    // Preview week 1 awards
    const result = await t.query(
      api.queries.categoryLeaderAwards.previewWeeklyAwards,
      { challengeId, weekNumber: 1 }
    );

    expect(result).not.toBeNull();
    const cardioAward = result!.awards.find(
      (a: any) => a.category.name === "Cardio"
    );
    expect(cardioAward).toBeDefined();

    // Weekly awards use a single division with division: null
    const overallDivision = cardioAward!.divisions[0];
    expect(overallDivision.division).toBeNull();

    // Alice should lead: 10mi > 8mi
    expect(overallDivision.placements[0].user.name).toBe("Alice");
    expect(overallDivision.placements[0].totalMetricValue).toBe(10);

    expect(overallDivision.placements[1].user.name).toBe("Bob");
    expect(overallDivision.placements[1].totalMetricValue).toBe(8);
  });

  it("falls back to totalPoints when no metric data is available", async () => {
    const { challengeId } = await setupChallenge();
    const cardioCategory = await createCategory("Cardio");

    // Activity type without a unit (completion-based)
    const completionType = await t.run(async (ctx) => {
      return ctx.db.insert("activityTypes", {
        challengeId,
        name: "Workout",
        categoryId: cardioCategory,
        scoringConfig: { type: "completion", fixedPoints: 10 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const alice = await createParticipant(
      challengeId,
      "alice@test.com",
      "Alice"
    );
    const bob = await createParticipant(
      challengeId,
      "bob@test.com",
      "Bob"
    );

    // No metric data (completion type has no unit, so metricValue = 0)
    await insertActivityWithMetrics(
      alice,
      challengeId,
      completionType,
      Date.UTC(2024, 0, 2),
      10,
      {}
    );
    await insertActivityWithMetrics(
      bob,
      challengeId,
      completionType,
      Date.UTC(2024, 0, 2),
      20,
      {}
    );

    const result = await t.query(
      api.queries.categoryLeaderAwards.previewWeeklyAwards,
      { challengeId, weekNumber: 0 }
    );

    expect(result).not.toBeNull();
    const cardioAward = result!.awards.find(
      (a: any) => a.category.name === "Cardio"
    );
    expect(cardioAward).toBeDefined();

    // Cumulative uses gender-split divisions; test users have no gender → "open"
    const openDivision = cardioAward!.divisions.find(
      (d: any) => d.division === "open"
    );
    expect(openDivision).toBeDefined();

    // Fallback: Bob leads by points (20 > 10)
    expect(openDivision!.placements[0].user.name).toBe("Bob");
    expect(openDivision!.placements[0].totalPoints).toBe(20);
  });

  it("returns the category unit in the response", async () => {
    const { challengeId } = await setupChallenge();
    const cardioCategory = await createCategory("Cardio");
    await createRunningActivityType(challengeId, cardioCategory);

    const alice = await createParticipant(
      challengeId,
      "alice@test.com",
      "Alice"
    );
    await insertActivityWithMetrics(
      alice,
      challengeId,
      await t.run(async (ctx) => {
        const types = await ctx.db
          .query("activityTypes")
          .withIndex("challengeId", (q: any) =>
            q.eq("challengeId", challengeId)
          )
          .collect();
        return types[0]._id;
      }),
      Date.UTC(2024, 0, 2),
      100,
      { miles: 10 }
    );

    const result = await t.query(
      api.queries.categoryLeaderAwards.previewWeeklyAwards,
      { challengeId, weekNumber: 0 }
    );

    const cardioAward = result!.awards.find(
      (a: any) => a.category.name === "Cardio"
    );
    expect(cardioAward!.category.unit).toBe("miles");

    // Verify divisions structure exists for cumulative
    expect(cardioAward!.divisions).toBeDefined();
    expect(cardioAward!.divisions.length).toBeGreaterThan(0);
  });
});
