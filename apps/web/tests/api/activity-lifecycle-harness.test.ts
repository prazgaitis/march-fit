import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { getChallengePointTotalForUser } from "@repo/backend/lib/activityPointsAggregate";
import {
  aggregateDailyStreakPoints,
  computeStreak,
} from "../../../../packages/backend/lib/streak";
import { dateOnlyToUtcMs } from "@/lib/date-only";
import {
  createTestActivityType,
  createTestChallenge,
  createTestContext,
  createTestParticipation,
  createTestUser,
} from "../helpers/convex";

function makeStravaActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 7001,
    name: "Harness Run",
    type: "Run",
    sport_type: "Run",
    start_date: "2024-03-11T07:30:00Z",
    start_date_local: "2024-03-10T23:30:00",
    elapsed_time: 1800,
    moving_time: 1740,
    distance: 5000,
    kudos_count: 0,
    achievement_count: 0,
    athlete_count: 1,
    photo_count: 0,
    private: false,
    flagged: false,
    ...overrides,
  };
}

async function assertLifecycleInvariants(
  t: ReturnType<typeof createTestContext>,
  userId: Id<"users">,
  challengeId: Id<"challenges">
) {
  const snapshot = await t.run(async (ctx) => {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) {
      throw new Error("Challenge not found for harness assertion");
    }

    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", userId).eq("challengeId", challengeId)
      )
      .first();
    if (!participation) {
      throw new Error("Participation not found for harness assertion");
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_challenge_date", (q) =>
        q.eq("userId", userId).eq("challengeId", challengeId)
      )
      .collect();

    const activeActivities = activities.filter((activity) => activity.deletedAt === undefined);
    const activityPoints = activeActivities.reduce(
      (sum, activity) => sum + activity.pointsEarned,
      0
    );

    const activityTypeIds = Array.from(
      new Set(activeActivities.map((activity) => String(activity.activityTypeId)))
    );
    const activityTypes = await Promise.all(
      activityTypeIds.map((activityTypeId) => ctx.db.get(activityTypeId as Id<"activityTypes">))
    );

    const contributesMap = new Map<string, boolean>();
    for (let i = 0; i < activityTypeIds.length; i += 1) {
      contributesMap.set(activityTypeIds[i], activityTypes[i]?.contributesToStreak ?? false);
    }

    const streak = computeStreak(
      aggregateDailyStreakPoints(
        activeActivities.map((activity) => ({
          loggedDate: activity.loggedDate,
          pointsEarned: activity.pointsEarned,
          activityTypeId: String(activity.activityTypeId),
        })),
        (activityTypeId) => contributesMap.get(activityTypeId) ?? false
      ),
      challenge.streakMinPoints
    );

    const aggregateTotal = await getChallengePointTotalForUser(ctx, challengeId, userId);

    return {
      participation,
      activityPoints,
      aggregateTotal,
      expectedStreakBonus: streak.totalStreakBonus,
      expectedCurrentStreak: streak.currentStreak,
      expectedTotalPoints: activityPoints + streak.totalStreakBonus,
    };
  });

  const leaderboard = await t.query(api.queries.participations.getFullLeaderboard, {
    challengeId,
  });
  const leaderboardEntry = leaderboard.find((entry) => entry.user.id === userId);

  expect(snapshot.aggregateTotal).toBe(snapshot.activityPoints);
  expect(snapshot.participation.totalPoints).toBe(snapshot.expectedTotalPoints);
  expect(snapshot.participation.streakBonusPoints ?? 0).toBe(snapshot.expectedStreakBonus);
  expect(snapshot.participation.currentStreak).toBe(snapshot.expectedCurrentStreak);
  expect(leaderboardEntry?.totalPoints).toBe(snapshot.expectedTotalPoints);

  return snapshot;
}

describe("Activity lifecycle harness", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("keeps totals and streak invariants stable across log/edit/delete/restore flows", async () => {
    const email = "harness-lifecycle@example.com";
    const userId = await createTestUser(t, { email });
    const challengeId = await createTestChallenge(t, userId, {
      startDate: "2024-03-01",
      endDate: "2024-03-31",
      streakMinPoints: 10,
    });
    await createTestParticipation(t, userId, challengeId);

    const activityTypeId = await createTestActivityType(t, challengeId, {
      name: "Running",
      scoringConfig: {
        type: "unit_based",
        unit: "minutes",
        pointsPerUnit: 1,
        basePoints: 0,
      },
      contributesToStreak: true,
    });

    const asUser = t.withIdentity({ subject: "harness-user", email });

    await assertLifecycleInvariants(t, userId, challengeId);

    const firstManual = await asUser.mutation(api.mutations.activities.log, {
      challengeId,
      activityTypeId,
      loggedDate: "2024-03-09T23:30:00-08:00",
      metrics: { minutes: 30 },
      source: "manual",
    });
    expect(firstManual.pointsEarned).toBe(30);
    await assertLifecycleInvariants(t, userId, challengeId);

    const secondManual = await asUser.mutation(api.mutations.activities.log, {
      challengeId,
      activityTypeId,
      loggedDate: "2024-03-10T03:30:00-07:00",
      metrics: { minutes: 20 },
      source: "manual",
    });
    expect(secondManual.pointsEarned).toBe(20);
    await assertLifecycleInvariants(t, userId, challengeId);

    await asUser.mutation(api.mutations.activities.editActivity, {
      activityId: firstManual.id,
      loggedDate: "2024-03-11",
      metrics: { minutes: 45 },
      notes: "harness-edit",
    });
    await assertLifecycleInvariants(t, userId, challengeId);

    await asUser.mutation(api.mutations.activities.remove, {
      activityId: secondManual.id,
    });
    await assertLifecycleInvariants(t, userId, challengeId);

    const stravaActivityId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity(),
      }
    );
    expect(stravaActivityId).toBeTruthy();
    const stravaActivity = await t.run((ctx) =>
      ctx.db.get(stravaActivityId as Id<"activities">)
    );
    expect(stravaActivity?.loggedDate).toBe(dateOnlyToUtcMs("2024-03-10"));
    await assertLifecycleInvariants(t, userId, challengeId);

    await t.mutation(internal.mutations.stravaWebhook.deleteFromStrava, {
      externalId: "7001",
    });
    await assertLifecycleInvariants(t, userId, challengeId);

    const restoredId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity({
          elapsed_time: 3600,
          moving_time: 3540,
          start_date: "2024-03-10T10:00:00Z",
          start_date_local: "2024-03-10T03:00:00",
        }),
      }
    );
    expect(restoredId).toBe(stravaActivityId);

    const restored = await t.run((ctx) => ctx.db.get(restoredId as Id<"activities">));
    expect(restored?.pointsEarned).toBe(60);
    expect(restored?.deletedAt).toBeUndefined();
    await assertLifecycleInvariants(t, userId, challengeId);
  });
});

describe("Local-date DST harness", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("normalizes ISO timestamps to date-only values across DST boundaries", async () => {
    const email = "harness-dst@example.com";
    const userId = await createTestUser(t, { email });
    const challengeId = await createTestChallenge(t, userId, {
      startDate: "2024-03-01",
      endDate: "2024-11-30",
      streakMinPoints: 1,
    });
    await createTestParticipation(t, userId, challengeId);

    const activityTypeId = await createTestActivityType(t, challengeId, {
      scoringConfig: {
        type: "unit_based",
        unit: "minutes",
        pointsPerUnit: 1,
        basePoints: 0,
      },
      contributesToStreak: true,
    });

    const asUser = t.withIdentity({ subject: "harness-dst-user", email });
    const dateCases = [
      {
        input: "2024-03-10T01:30:00-08:00",
        expectedDateOnly: "2024-03-10",
      },
      {
        input: "2024-03-10T03:30:00-07:00",
        expectedDateOnly: "2024-03-10",
      },
      {
        input: "2024-11-03T01:30:00-07:00",
        expectedDateOnly: "2024-11-03",
      },
      {
        input: "2024-11-03T01:30:00-08:00",
        expectedDateOnly: "2024-11-03",
      },
    ] as const;

    for (let i = 0; i < dateCases.length; i += 1) {
      const dateCase = dateCases[i];
      const result = await asUser.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: dateCase.input,
        metrics: { minutes: i + 1 },
        source: "manual",
      });
      const storedActivity = await t.run((ctx) =>
        ctx.db.get(result.id as Id<"activities">)
      );
      expect(storedActivity?.loggedDate).toBe(dateOnlyToUtcMs(dateCase.expectedDateOnly));
    }

    await assertLifecycleInvariants(t, userId, challengeId);
  });
});
