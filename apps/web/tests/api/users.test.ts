import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@repo/backend";
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
          loggedDate: new Date("2025-01-03T00:00:00.000Z").getTime(),
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
          loggedDate: new Date("2025-01-04T00:00:00.000Z").getTime(),
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
          loggedDate: new Date("2025-01-05T00:00:00.000Z").getTime(),
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
          loggedDate: new Date("2025-02-10T00:00:00.000Z").getTime(),
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
          loggedDate: new Date("2025-02-10T00:00:00.000Z").getTime(),
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
          loggedDate: new Date("2025-02-11T00:00:00.000Z").getTime(),
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
});
