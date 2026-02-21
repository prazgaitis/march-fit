import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestActivityType,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import { dateOnlyToUtcMs } from "@/lib/date-only";
import { getChallengePointTotalForUser } from "@repo/backend/lib/activityPointsAggregate";
import { insertTestActivity } from "../helpers/activities";

describe("Points negative + local date grouping", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  it("includes negative points and excludes deleted activities in totals", async () => {
    const userId = await createTestUser(t, { email: "negative@test.com" });
    const challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);
    const activityTypeId = await createTestActivityType(t, challengeId);

    await t.run(async (ctx) => {
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId,
        loggedDate: Date.UTC(2024, 0, 15),
        metrics: {},
        source: "manual",
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId,
        loggedDate: Date.UTC(2024, 0, 16),
        metrics: {},
        source: "manual",
        pointsEarned: -5,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId,
        loggedDate: Date.UTC(2024, 0, 17),
        metrics: {},
        source: "manual",
        pointsEarned: 7,
        deletedAt: Date.now(),
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const leaderboard = await t.query(
      api.queries.participations.getFullLeaderboard,
      { challengeId }
    );

    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].totalPoints).toBe(5);

    const aggregateTotal = await t.run(async (ctx) =>
      getChallengePointTotalForUser(ctx, challengeId, userId)
    );
    expect(aggregateTotal).toBe(5);
  });

  it("groups daily totals by local date (ignores time-of-day)", async () => {
    const userId = await createTestUser(t, { email: "localdate@test.com" });
    const challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);
    const activityTypeId = await createTestActivityType(t, challengeId);

    await t.run(async (ctx) => {
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId,
        loggedDate: Date.UTC(2024, 0, 10, 1, 0, 0),
        metrics: {},
        source: "manual",
        pointsEarned: 3,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId,
        loggedDate: Date.UTC(2024, 0, 10, 23, 0, 0),
        metrics: {},
        source: "manual",
        pointsEarned: 4,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await insertTestActivity(ctx, {
        userId: userId as Id<"users">,
        challengeId: challengeId as Id<"challenges">,
        activityTypeId,
        loggedDate: Date.UTC(2024, 0, 11, 12, 0, 0),
        metrics: {},
        source: "manual",
        pointsEarned: 6,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const profile = await t.query(api.queries.users.getProfile, {
      userId,
      challengeId,
    });

    expect(profile?.stats.prDay?.date).toBe("2024-01-10");
    expect(profile?.stats.prDay?.totalPoints).toBe(7);
    expect(profile?.stats.prDay?.activities).toHaveLength(2);
  });

  it("normalizes ISO timestamps to a local date-only value on log", async () => {
    const testEmail = "localdate-log@example.com";
    const userId = await createTestUser(t, { email: testEmail });
    const tWithAuth = t.withIdentity({ subject: "user-subject", email: testEmail });
    const challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);
    const activityTypeId = await createTestActivityType(t, challengeId);

    const result = await tWithAuth.mutation(api.mutations.activities.log, {
      challengeId,
      activityTypeId,
      loggedDate: "2024-01-15T23:30:00-05:00",
      metrics: { minutes: 10 },
      source: "manual",
    });

    const activity = await t.run(async (ctx) =>
      ctx.db.get(result.id as Id<"activities">)
    );

    expect(activity?.loggedDate).toBe(dateOnlyToUtcMs("2024-01-15"));
  });
});
