import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "@repo/backend";
import { dateOnlyToUtcMs } from "@/lib/date-only";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestActivityType,
  createTestParticipation,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";

describe("Streak Bonus Integration", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  /** Helper: set up a challenge with a streak-eligible activity type */
  async function setupChallenge(opts?: { streakMinPoints?: number }) {
    const email = "streak@example.com";
    const userId = await createTestUser(t, { email });
    const tAuth = t.withIdentity({ subject: "streak-user", email });
    const challengeId = await createTestChallenge(t, userId, {
      streakMinPoints: opts?.streakMinPoints ?? 10,
    });
    await createTestParticipation(t, userId, challengeId);

    const activityTypeId = await createTestActivityType(t, challengeId, {
      name: "Exercise",
      scoringConfig: { type: "fixed", basePoints: 10 },
      contributesToStreak: true,
    });

    return { userId, tAuth, challengeId, activityTypeId };
  }

  /** Helper: log an activity on a given date */
  async function logActivity(
    tAuth: ReturnType<typeof t.withIdentity>,
    challengeId: string,
    activityTypeId: string,
    date: string,
    overrides?: { notes?: string; source?: string }
  ) {
    return tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<"challenges">,
      activityTypeId: activityTypeId as Id<"activityTypes">,
      loggedDate: date,
      source: overrides?.source ?? "manual",
      notes: overrides?.notes,
    });
  }

  /** Helper: read participation record */
  async function getParticipation(userId: string, challengeId: string) {
    return t.run(async (ctx) => {
      return ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q: any) =>
          q
            .eq("userId", userId as Id<"users">)
            .eq("challengeId", challengeId as Id<"challenges">)
        )
        .first();
    });
  }

  it("single qualifying day → streakBonusPoints=1, totalPoints=activityPts+1", async () => {
    const { userId, tAuth, challengeId, activityTypeId } = await setupChallenge();

    const result = await logActivity(tAuth, challengeId, activityTypeId, "2024-01-05");

    const participation = await getParticipation(userId, challengeId);
    expect(participation).not.toBeNull();
    expect(participation!.streakBonusPoints).toBe(1);
    expect(participation!.totalPoints).toBe(result.pointsEarned + 1);
    expect(participation!.currentStreak).toBe(1);
  });

  it("3 consecutive days → streakBonusPoints=6, totalPoints correct", async () => {
    const { userId, tAuth, challengeId, activityTypeId } = await setupChallenge();

    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-05");
    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-06");
    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-07");

    const participation = await getParticipation(userId, challengeId);
    // Streak bonus: day1=1, day2=2, day3=3 → total=6
    expect(participation!.streakBonusPoints).toBe(6);
    expect(participation!.currentStreak).toBe(3);
    // Total = 3 * 10 (activity points) + 6 (streak bonus)
    expect(participation!.totalPoints).toBe(36);
  });

  it("delete middle day → streak splits, bonus recalculated, totalPoints decreases", async () => {
    const { userId, tAuth, challengeId, activityTypeId } = await setupChallenge();

    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-05");
    const day2 = await logActivity(tAuth, challengeId, activityTypeId, "2024-01-06");
    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-07");

    // Verify 3-day streak first
    let participation = await getParticipation(userId, challengeId);
    expect(participation!.streakBonusPoints).toBe(6);

    // Delete middle day activity
    await tAuth.mutation(api.mutations.activities.remove, {
      activityId: day2.id as Id<"activities">,
    });

    participation = await getParticipation(userId, challengeId);
    // Now two isolated days: day1=1, day3=1 → bonus=2
    expect(participation!.streakBonusPoints).toBe(2);
    expect(participation!.currentStreak).toBe(1);
    // Total = 2 * 10 (remaining activities) + 2 (streak bonus)
    expect(participation!.totalPoints).toBe(22);
  });

  it("non-streak activity → streakBonusPoints unchanged", async () => {
    const { userId, tAuth, challengeId } = await setupChallenge();

    // Create a non-streak activity type
    const nonStreakTypeId = await createTestActivityType(t, challengeId, {
      name: "Stretching",
      scoringConfig: { type: "fixed", basePoints: 5 },
      contributesToStreak: false,
    });

    await logActivity(tAuth, challengeId, nonStreakTypeId, "2024-01-05");

    const participation = await getParticipation(userId, challengeId);
    expect(participation!.streakBonusPoints ?? 0).toBe(0);
    expect(participation!.currentStreak).toBe(0);
    // Total = 5 (activity points) + 0 (no streak)
    expect(participation!.totalPoints).toBe(5);
  });

  it("below-threshold day → no streak bonus", async () => {
    const { userId, tAuth, challengeId } = await setupChallenge({
      streakMinPoints: 10,
    });

    // Create a low-scoring activity type (below streak threshold)
    const lowTypeId = await createTestActivityType(t, challengeId, {
      name: "Light Walk",
      scoringConfig: { type: "fixed", basePoints: 5 },
      contributesToStreak: true,
    });

    await logActivity(tAuth, challengeId, lowTypeId, "2024-01-05");

    const participation = await getParticipation(userId, challengeId);
    // 5 points < 10 threshold → no streak
    expect(participation!.streakBonusPoints ?? 0).toBe(0);
    expect(participation!.currentStreak).toBe(0);
    expect(participation!.totalPoints).toBe(5);
  });

  it("leaderboard ranking → user with streak outranks user with same activity pts but no streak", async () => {
    const emailA = "streaker@example.com";
    const emailB = "nostreak@example.com";
    const userA = await createTestUser(t, {
      email: emailA,
      username: "streaker",
    });
    const userB = await createTestUser(t, {
      email: emailB,
      username: "nostreaker",
    });

    const tAuthA = t.withIdentity({ subject: "user-a", email: emailA });
    const tAuthB = t.withIdentity({ subject: "user-b", email: emailB });

    const challengeId = await createTestChallenge(t, userA, {
      streakMinPoints: 10,
    });
    await createTestParticipation(t, userA, challengeId);
    await createTestParticipation(t, userB, challengeId);

    const streakTypeId = await createTestActivityType(t, challengeId, {
      name: "Exercise",
      scoringConfig: { type: "fixed", basePoints: 10 },
      contributesToStreak: true,
    });

    const nonStreakTypeId = await createTestActivityType(t, challengeId, {
      name: "Bonus Task",
      scoringConfig: { type: "fixed", basePoints: 10 },
      contributesToStreak: false,
    });

    // User A: 3 consecutive days with streak-eligible activities (30 pts + 6 bonus = 36)
    await logActivity(tAuthA, challengeId, streakTypeId, "2024-01-05");
    await logActivity(tAuthA, challengeId, streakTypeId, "2024-01-06");
    await logActivity(tAuthA, challengeId, streakTypeId, "2024-01-07");

    // User B: 3 activities on same day, non-streak (30 pts + 0 bonus = 30)
    await logActivity(tAuthB, challengeId, nonStreakTypeId, "2024-01-05");
    await logActivity(tAuthB, challengeId, nonStreakTypeId, "2024-01-06");
    await logActivity(tAuthB, challengeId, nonStreakTypeId, "2024-01-07");

    // Query leaderboard
    const leaderboard = await t.query(
      api.queries.participations.getFullLeaderboard,
      { challengeId: challengeId as Id<"challenges"> }
    );

    expect(leaderboard.length).toBeGreaterThanOrEqual(2);
    // User A should rank higher due to streak bonus
    const rankA = leaderboard.find((e: any) => e.user.id === userA);
    const rankB = leaderboard.find((e: any) => e.user.id === userB);
    expect(rankA).toBeDefined();
    expect(rankB).toBeDefined();
    expect(rankA!.totalPoints).toBeGreaterThan(rankB!.totalPoints);
  });

  it("verify action → detects mismatch and fix corrects it", async () => {
    const { userId, tAuth, challengeId, activityTypeId } = await setupChallenge();

    // Log 3 consecutive days
    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-05");
    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-06");
    await logActivity(tAuth, challengeId, activityTypeId, "2024-01-07");

    // Verify correct state first
    let participation = await getParticipation(userId, challengeId);
    expect(participation!.totalPoints).toBe(36); // 30 + 6

    // Corrupt the totalPoints directly
    await t.run(async (ctx) => {
      await ctx.db.patch(participation!._id, {
        totalPoints: 999,
        streakBonusPoints: 0,
        currentStreak: 0,
      });
    });

    // Verify detects mismatch (dry run)
    const dryResult = await t.mutation(
      internal.mutations.verifyScores.verifyUserScore,
      {
        challengeId: challengeId as Id<"challenges">,
        userId: userId as Id<"users">,
        fix: false,
      }
    );

    expect(dryResult.mismatches).toBe(1);
    expect(dryResult.diffs[0].stored.totalPoints).toBe(999);
    expect(dryResult.diffs[0].expected.totalPoints).toBe(36);
    expect(dryResult.diffs[0].fixed).toBe(false);

    // Still corrupted
    participation = await getParticipation(userId, challengeId);
    expect(participation!.totalPoints).toBe(999);

    // Now fix
    const fixResult = await t.mutation(
      internal.mutations.verifyScores.verifyUserScore,
      {
        challengeId: challengeId as Id<"challenges">,
        userId: userId as Id<"users">,
        fix: true,
      }
    );

    expect(fixResult.mismatches).toBe(1);
    expect(fixResult.diffs[0].fixed).toBe(true);

    // Verify fixed
    participation = await getParticipation(userId, challengeId);
    expect(participation!.totalPoints).toBe(36);
    expect(participation!.streakBonusPoints).toBe(6);
    expect(participation!.currentStreak).toBe(3);
  });
});
