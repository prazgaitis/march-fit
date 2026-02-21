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

describe("Users Queries", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  describe("getActivities", () => {
    it("returns paginated activities for the profile user scoped to one challenge", async () => {
      const userId = await createTestUser(t, { email: "activities@example.com" });
      const challengeId = await createTestChallenge(t, userId, { name: "Challenge A" });
      const otherChallengeId = await createTestChallenge(t, userId, { name: "Challenge B" });
      const activityTypeA = await createTestActivityType(t, challengeId, { name: "Run" });
      const activityTypeB = await createTestActivityType(t, otherChallengeId, { name: "Bike" });

      await t.run(async (ctx) => {
        await ctx.db.insert("activities", {
          userId: userId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: activityTypeA as Id<"activityTypes">,
          loggedDate: dateOnlyToUtcMs("2025-01-03"),
          pointsEarned: 15,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          source: "manual",
          createdAt: 1000,
          updatedAt: 1000,
        });
        await ctx.db.insert("activities", {
          userId: userId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: activityTypeA as Id<"activityTypes">,
          loggedDate: dateOnlyToUtcMs("2025-01-04"),
          pointsEarned: 20,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          source: "manual",
          createdAt: 2000,
          updatedAt: 2000,
        });
        await ctx.db.insert("activities", {
          userId: userId as Id<"users">,
          challengeId: otherChallengeId as Id<"challenges">,
          activityTypeId: activityTypeB as Id<"activityTypes">,
          loggedDate: dateOnlyToUtcMs("2025-01-05"),
          pointsEarned: 30,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          source: "manual",
          createdAt: 3000,
          updatedAt: 3000,
        });
      });

      const pageOne = await t.query(api.queries.users.getActivities, {
        userId,
        challengeId,
        paginationOpts: { numItems: 1, cursor: null },
      });

      expect(pageOne.page).toHaveLength(1);
      expect(pageOne.page[0].activity.challengeId).toBe(challengeId);
      expect(pageOne.page[0].activityType?.name).toBe("Run");
      expect(pageOne.isDone).toBe(false);
      expect(pageOne.continueCursor).toBe("1");

      const pageTwo = await t.query(api.queries.users.getActivities, {
        userId,
        challengeId,
        paginationOpts: { numItems: 1, cursor: pageOne.continueCursor },
      });

      expect(pageTwo.page).toHaveLength(1);
      expect(pageTwo.page[0].activity.challengeId).toBe(challengeId);
      expect(pageTwo.isDone).toBe(true);
      expect(pageTwo.continueCursor).toBeNull();
    });
  });

  describe("getProfile PR day", () => {
    it("returns highest scoring day with contributing activities", async () => {
      const userId = await createTestUser(t, { email: "prday@example.com" });
      const challengeId = await createTestChallenge(t, userId, { name: "PR Challenge" });
      await createTestParticipation(t, userId, challengeId);
      const runTypeId = await createTestActivityType(t, challengeId, { name: "Run" });
      const bikeTypeId = await createTestActivityType(t, challengeId, { name: "Bike" });

      await t.run(async (ctx) => {
        await ctx.db.insert("activities", {
          userId: userId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: runTypeId as Id<"activityTypes">,
          loggedDate: dateOnlyToUtcMs("2025-02-10"),
          pointsEarned: 12,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          source: "manual",
          createdAt: 1000,
          updatedAt: 1000,
        });
        await ctx.db.insert("activities", {
          userId: userId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: bikeTypeId as Id<"activityTypes">,
          loggedDate: dateOnlyToUtcMs("2025-02-10"),
          pointsEarned: 18,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          source: "manual",
          createdAt: 1100,
          updatedAt: 1100,
        });
        await ctx.db.insert("activities", {
          userId: userId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: bikeTypeId as Id<"activityTypes">,
          loggedDate: dateOnlyToUtcMs("2025-02-11"),
          pointsEarned: 20,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          source: "manual",
          createdAt: 1200,
          updatedAt: 1200,
        });
      });

      const profile = await t.query(api.queries.users.getProfile, {
        userId,
        challengeId,
      });

      expect(profile).not.toBeNull();
      expect(profile?.stats.prDay).toMatchObject({
        date: "2025-02-10",
        totalPoints: 30,
      });
      expect(profile?.stats.prDay?.activities).toHaveLength(2);
      expect(profile?.stats.prDay?.activities[0].activityTypeName).toBeDefined();
    });
  });

  it("getProfile uses activity-derived total points and rank", async () => {
    const ownerId = await createTestUser(t, {
      email: "owner-users-profile@example.com",
      username: "owner_users_profile",
    });
    const challengeId = await createTestChallenge(t, ownerId);
    const userId = await createTestUser(t, {
      email: "profile-negative@example.com",
      username: "profile_negative",
    });
    const otherId = await createTestUser(t, {
      email: "profile-positive@example.com",
      username: "profile_positive",
    });

    await createTestParticipation(t, userId, challengeId, { totalPoints: 999 });
    await createTestParticipation(t, otherId, challengeId, { totalPoints: -999 });

    await t.run(async (ctx) => {
      const penaltyTypeId = await ctx.db.insert("activityTypes", {
        challengeId: challengeId as Id<"challenges">,
        name: "Penalty",
        scoringConfig: { unit: "count", pointsPerUnit: 1 },
        contributesToStreak: false,
        isNegative: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const runTypeId = await ctx.db.insert("activityTypes", {
        challengeId: challengeId as Id<"challenges">,
        name: "Run",
        scoringConfig: { unit: "minutes", pointsPerUnit: 1 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("activities", {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: penaltyTypeId,
        loggedDate: dateOnlyToUtcMs("2024-01-10"),
        metrics: { count: 1 },
        pointsEarned: -7,
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("activities", {
        userId: otherId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: runTypeId,
        loggedDate: dateOnlyToUtcMs("2024-01-10"),
        metrics: { minutes: 3 },
        pointsEarned: 3,
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.queries.users.getProfile, {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    });

    expect(result).not.toBeNull();
    expect(result!.participation).not.toBeNull();
    expect(result!.participation!.totalPoints).toBe(-7);
    expect(result!.participation!.rank).toBe(2);
    expect(result!.stats.recentActivities[0].isNegative).toBe(true);
  });

  it("getGlobalProfile sums points from activities (including negatives)", async () => {
    const ownerId = await createTestUser(t, {
      email: "owner-global@example.com",
      username: "owner_global_profile",
    });
    const userId = await createTestUser(t, {
      email: "global-profile@example.com",
      username: "global_profile",
    });
    const challengeA = await createTestChallenge(t, ownerId, { name: "Challenge A" });
    const challengeB = await createTestChallenge(t, ownerId, { name: "Challenge B" });

    await createTestParticipation(t, userId, challengeA, { totalPoints: 100 });
    await createTestParticipation(t, userId, challengeB, { totalPoints: 200 });

    await t.run(async (ctx) => {
      const typeA = await ctx.db.insert("activityTypes", {
        challengeId: challengeA as Id<"challenges">,
        name: "Run A",
        scoringConfig: { unit: "minutes", pointsPerUnit: 1 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const typeB = await ctx.db.insert("activityTypes", {
        challengeId: challengeB as Id<"challenges">,
        name: "Penalty B",
        scoringConfig: { unit: "count", pointsPerUnit: 1 },
        contributesToStreak: false,
        isNegative: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("activities", {
        userId: userId as Id<"users">,
        challengeId: challengeA as Id<"challenges">,
        activityTypeId: typeA,
        loggedDate: dateOnlyToUtcMs("2024-01-11"),
        metrics: { minutes: 10 },
        pointsEarned: 10,
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("activities", {
        userId: userId as Id<"users">,
        challengeId: challengeA as Id<"challenges">,
        activityTypeId: typeA,
        loggedDate: dateOnlyToUtcMs("2024-01-11"),
        metrics: { minutes: 4 },
        pointsEarned: -4,
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("activities", {
        userId: userId as Id<"users">,
        challengeId: challengeB as Id<"challenges">,
        activityTypeId: typeB,
        loggedDate: dateOnlyToUtcMs("2024-01-12"),
        metrics: { count: 1 },
        pointsEarned: -8,
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.queries.users.getGlobalProfile, {
      userId: userId as Id<"users">,
    });

    expect(result).not.toBeNull();
    expect(result!.stats.totalPoints).toBe(-2);

    const pointsByChallengeName = new Map(
      result!.participations.map((p) => [p.challenge?.name, p.totalPoints])
    );
    expect(pointsByChallengeName.get("Challenge A")).toBe(6);
    expect(pointsByChallengeName.get("Challenge B")).toBe(-8);
  });
});
