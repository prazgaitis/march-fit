import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";
import type { Id } from "@repo/backend/_generated/dataModel";

const TEST_NOW = new Date("2024-01-10T00:00:00Z").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("Mini-Game Audit", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  const createUserWithParticipation = async (
    challengeId: string,
    totalPoints: number,
    overrides: { username?: string } = {}
  ) => {
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: `${overrides.username || "user"}@example.com`,
        name: "Test User",
        username:
          overrides.username ||
          `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        role: "user",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userChallenges", {
        userId,
        challengeId,
        joinedAt: Date.now(),
        totalPoints,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        updatedAt: Date.now(),
      });
    });

    return userId;
  };

  const createActivityType = async (challengeId: string) => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("activityTypes", {
        challengeId,
        name: "Running",
        kind: "core",
        scoringConfig: { unit: "minutes", pointsPerUnit: 1, basePoints: 0 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  const logActivity = async (
    userId: string,
    challengeId: string,
    activityTypeId: string,
    pointsEarned: number,
    loggedDate: number,
    source: string = "manual"
  ) => {
    return await t.run(async (ctx) => {
      const activityId = await insertTestActivity(ctx, {
        userId,
        challengeId,
        activityTypeId,
        loggedDate,
        metrics: { minutes: pointsEarned },
        pointsEarned,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "resolved",
        source,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", userId).eq("challengeId", challengeId)
        )
        .first();

      if (participation) {
        await ctx.db.patch(participation._id, {
          totalPoints: participation.totalPoints + pointsEarned,
        });
      }

      return activityId;
    });
  };

  /**
   * Simulate the double-counting bug: run a hunt week game through the normal
   * lifecycle, but then manually tamper with the participant outcomes to reflect
   * what the old buggy code would have produced.
   */
  const setupCompletedGameWithBadOutcomes = async () => {
    const adminUser = await createTestUser(t, {
      email: "admin@example.com",
      role: "admin",
    });
    const tWithAuth = t.withIdentity({
      subject: "admin-user-id",
      email: "admin@example.com",
    });
    const challengeId = await createTestChallenge(t, adminUser);
    const activityTypeId = await createActivityType(challengeId);

    // user1: 200 pts from activities before game start
    // user2: 100 pts from activities before game start
    const user1 = await createUserWithParticipation(challengeId, 0, {
      username: "alice",
    });
    const user2 = await createUserWithParticipation(challengeId, 0, {
      username: "bob",
    });
    await logActivity(
      user1,
      challengeId,
      activityTypeId,
      200,
      TEST_NOW - DAY_MS
    );
    await logActivity(
      user2,
      challengeId,
      activityTypeId,
      100,
      TEST_NOW - DAY_MS
    );

    // user2 logs 120 pts during the game → user2 total = 220 > user1's 200
    // So user2 should catch user1 (prey)
    const { miniGameId } = await tWithAuth.mutation(
      api.mutations.miniGames.create,
      {
        challengeId,
        type: "hunt_week",
        name: "Buggy Hunt",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      }
    );

    await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
    await logActivity(
      user2,
      challengeId,
      activityTypeId,
      120,
      TEST_NOW + 1000
    );

    // End the game normally (this uses the fixed code, producing correct outcomes)
    await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

    // Now tamper with participant records to simulate the old buggy outcomes.
    // In the buggy version, user1 was NOT caught (because double-counted points
    // inflated user1's score and user2 didn't surpass). We flip the stored outcomes.
    const participants = await t.run(async (ctx) => {
      return await ctx.db
        .query("miniGameParticipants")
        .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
        .collect();
    });

    const p1 = participants.find((p) => p.userId === user1)!;
    const p2 = participants.find((p) => p.userId === user2)!;

    // Tamper: pretend user1 held rank (wasn't caught) and user2 didn't catch
    await t.run(async (ctx) => {
      // Delete existing bonus activities and reverse points
      for (const p of [p1, p2]) {
        if (p.bonusActivityId) {
          const activity = await ctx.db.get(p.bonusActivityId);
          if (activity && !activity.deletedAt) {
            const uc = await ctx.db
              .query("userChallenges")
              .withIndex("userChallengeUnique", (q) =>
                q.eq("userId", p.userId).eq("challengeId", challengeId)
              )
              .first();
            if (uc) {
              await ctx.db.patch(uc._id, {
                totalPoints: uc.totalPoints - activity.pointsEarned,
              });
            }
            await ctx.db.patch(activity._id, { deletedAt: Date.now() });
          }
        }
      }

      // Create wrong bonus activities to simulate buggy awards
      const bonusType = await ctx.db
        .query("activityTypes")
        .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
        .filter((q) => q.eq(q.field("name"), "Mini-Game Bonus"))
        .first();

      // user1 was incorrectly given +75 (held rank, wasn't caught)
      const wrongActivity1 = await ctx.db.insert("activities", {
        userId: user1,
        challengeId,
        activityTypeId: bonusType!._id,
        loggedDate: Date.now(),
        pointsEarned: 75,
        notes: "Hunt Week: Caught prey! (+75)",
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "resolved",
        source: "mini_game",
        externalId: `mini_game_wrong_${user1}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const uc1 = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user1).eq("challengeId", challengeId)
        )
        .first();
      if (uc1)
        await ctx.db.patch(uc1._id, { totalPoints: uc1.totalPoints + 75 });

      // user2 was incorrectly given 0 (didn't catch prey)
      await ctx.db.patch(p1._id, {
        bonusPoints: 75,
        bonusActivityId: wrongActivity1,
        outcome: {
          caughtPrey: true,
          wasCaught: false,
          initialRank: 1,
          finalRank: 1,
        },
      });

      await ctx.db.patch(p2._id, {
        bonusPoints: 0,
        bonusActivityId: undefined,
        outcome: {
          caughtPrey: false,
          wasCaught: false,
          initialRank: 2,
          finalRank: 2,
        },
      });
    });

    return { miniGameId, challengeId, user1, user2, activityTypeId };
  };

  describe("audit", () => {
    it("should detect no discrepancies for correctly scored games", async () => {
      const adminUser = await createTestUser(t, {
        email: "admin@example.com",
        role: "admin",
      });
      const tWithAuth = t.withIdentity({
        subject: "admin-user-id",
        email: "admin@example.com",
      });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, {
        username: "user1",
      });
      const user2 = await createUserWithParticipation(challengeId, 0, {
        username: "user2",
      });
      await logActivity(
        user1,
        challengeId,
        activityTypeId,
        100,
        TEST_NOW - DAY_MS
      );
      await logActivity(
        user2,
        challengeId,
        activityTypeId,
        50,
        TEST_NOW - DAY_MS
      );

      const { miniGameId } = await tWithAuth.mutation(
        api.mutations.miniGames.create,
        {
          challengeId,
          type: "hunt_week",
          name: "Correct Game",
          startsAt: TEST_NOW,
          endsAt: TEST_NOW + WEEK_MS,
        }
      );
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const results = await t.query(
        internal.mutations.miniGameAudit.audit,
        {}
      );

      expect(results).toHaveLength(1);
      expect(results[0].hasDiscrepancies).toBe(false);
      expect(results[0].diffs.every((d) => d.delta === 0)).toBe(true);
    });

    it("should detect discrepancies for incorrectly scored games", async () => {
      const { miniGameId, user1, user2 } =
        await setupCompletedGameWithBadOutcomes();

      const results = await t.query(
        internal.mutations.miniGameAudit.audit,
        {}
      );

      expect(results).toHaveLength(1);
      expect(results[0].hasDiscrepancies).toBe(true);

      const aliceDiff = results[0].diffs.find((d) => d.userId === user1);
      const bobDiff = results[0].diffs.find((d) => d.userId === user2);

      // alice was incorrectly given +75, correct is -25 (was caught)
      expect(aliceDiff!.storedBonusPoints).toBe(75);
      expect(aliceDiff!.correctBonusPoints).toBe(-25);
      expect(aliceDiff!.delta).toBe(-100);
      expect(aliceDiff!.correctOutcome.wasCaught).toBe(true);

      // bob was incorrectly given 0, correct is +75 (caught prey)
      expect(bobDiff!.storedBonusPoints).toBe(0);
      expect(bobDiff!.correctBonusPoints).toBe(75);
      expect(bobDiff!.delta).toBe(75);
      expect(bobDiff!.correctOutcome.caughtPrey).toBe(true);
    });

    it("should only return completed hunt week games", async () => {
      const adminUser = await createTestUser(t, {
        email: "admin@example.com",
        role: "admin",
      });
      const tWithAuth = t.withIdentity({
        subject: "admin-user-id",
        email: "admin@example.com",
      });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, {
        username: "user1",
      });

      // Create a draft hunt week (should not appear)
      await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Draft Hunt",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      // Create a completed partner week (should not appear)
      const { miniGameId: pwId } = await tWithAuth.mutation(
        api.mutations.miniGames.create,
        {
          challengeId,
          type: "partner_week",
          name: "PW",
          startsAt: TEST_NOW + WEEK_MS,
          endsAt: TEST_NOW + 2 * WEEK_MS,
        }
      );
      await tWithAuth.mutation(api.mutations.miniGames.start, {
        miniGameId: pwId,
      });
      await tWithAuth.mutation(api.mutations.miniGames.end, {
        miniGameId: pwId,
      });

      const results = await t.query(
        internal.mutations.miniGameAudit.audit,
        {}
      );
      expect(results).toHaveLength(0);
    });
  });

  describe("fix", () => {
    it("should correct all discrepant scores", async () => {
      const { miniGameId, challengeId, user1, user2 } =
        await setupCompletedGameWithBadOutcomes();

      const summary = await t.mutation(
        internal.mutations.miniGameAudit.fix,
        {}
      );

      expect(summary).toHaveLength(1);
      expect(summary[0].fixed).toBe(2);
      expect(summary[0].skipped).toBe(0);

      // Verify participant records are updated
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const p1 = participants.find((p) => p.userId === user1)!;
      const p2 = participants.find((p) => p.userId === user2)!;

      expect(p1.bonusPoints).toBe(-25);
      expect(p1.outcome.wasCaught).toBe(true);
      expect(p1.outcome.previousBonusPoints).toBe(75);

      expect(p2.bonusPoints).toBe(75);
      expect(p2.outcome.caughtPrey).toBe(true);
      expect(p2.outcome.previousBonusPoints).toBe(0);

      // Verify new bonus activities exist with correction notes
      const bonusActivities = await t.run(async (ctx) => {
        return await ctx.db
          .query("activities")
          .withIndex("sourceExternalId", (q) => q.eq("source", "mini_game"))
          .filter((q) => q.eq(q.field("challengeId"), challengeId))
          .collect();
      });

      const activeBonus = bonusActivities.filter((a) => !a.deletedAt);

      // alice gets -25, bob gets +75
      const aliceBonus = activeBonus.find((a) => a.userId === user1);
      const bobBonus = activeBonus.find((a) => a.userId === user2);

      expect(aliceBonus!.pointsEarned).toBe(-25);
      expect(aliceBonus!.notes).toContain("[Score correction]");
      expect(aliceBonus!.notes).toContain("alice");
      expect(aliceBonus!.notes).toContain("bob");
      expect(aliceBonus!.notes).toContain("double-counting");

      expect(bobBonus!.pointsEarned).toBe(75);
      expect(bobBonus!.notes).toContain("[Score correction]");
    });

    it("should skip unfavorable fixes when favorableOnly is true", async () => {
      const { miniGameId, challengeId, user1, user2 } =
        await setupCompletedGameWithBadOutcomes();

      const summary = await t.mutation(
        internal.mutations.miniGameAudit.fix,
        { favorableOnly: true }
      );

      expect(summary).toHaveLength(1);
      expect(summary[0].fixed).toBe(1);
      expect(summary[0].skipped).toBe(1);

      // alice (delta = -100) should be skipped
      const aliceDetail = summary[0].details.find(
        (d) => d.username === "alice"
      );
      expect(aliceDetail!.action).toBe("skipped (unfavorable)");

      // bob (delta = +75) should be fixed
      const bobDetail = summary[0].details.find((d) => d.username === "bob");
      expect(bobDetail!.action).toBe("fixed");

      // alice's participant record should be unchanged
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const p1 = participants.find((p) => p.userId === user1)!;
      expect(p1.bonusPoints).toBe(75); // unchanged from buggy value

      const p2 = participants.find((p) => p.userId === user2)!;
      expect(p2.bonusPoints).toBe(75); // fixed
    });

    it("should target a specific game when miniGameId is provided", async () => {
      const { miniGameId } = await setupCompletedGameWithBadOutcomes();

      const summary = await t.mutation(
        internal.mutations.miniGameAudit.fix,
        { miniGameId: miniGameId as Id<"miniGames"> }
      );

      expect(summary).toHaveLength(1);
      expect(summary[0].miniGameId).toBe(miniGameId);
      expect(summary[0].fixed).toBe(2);
    });

    it("should not create bonus activity when correct bonus is 0", async () => {
      const adminUser = await createTestUser(t, {
        email: "admin@example.com",
        role: "admin",
      });
      const tWithAuth = t.withIdentity({
        subject: "admin-user-id",
        email: "admin@example.com",
      });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      // Two users with equal points — neither catches the other
      const user1 = await createUserWithParticipation(challengeId, 0, {
        username: "user1",
      });
      const user2 = await createUserWithParticipation(challengeId, 0, {
        username: "user2",
      });
      await logActivity(
        user1,
        challengeId,
        activityTypeId,
        100,
        TEST_NOW - DAY_MS
      );
      await logActivity(
        user2,
        challengeId,
        activityTypeId,
        50,
        TEST_NOW - DAY_MS
      );

      const { miniGameId } = await tWithAuth.mutation(
        api.mutations.miniGames.create,
        {
          challengeId,
          type: "hunt_week",
          name: "Zero Fix Game",
          startsAt: TEST_NOW,
          endsAt: TEST_NOW + WEEK_MS,
        }
      );
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Tamper: give user2 a wrong bonus of +75 when correct is 0
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const p2 = participants.find((p) => p.userId === user2)!;
      await t.run(async (ctx) => {
        const bonusType = await ctx.db
          .query("activityTypes")
          .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
          .filter((q) => q.eq(q.field("name"), "Mini-Game Bonus"))
          .first();

        if (!bonusType) return;

        const activityId = await ctx.db.insert("activities", {
          userId: user2,
          challengeId,
          activityTypeId: bonusType._id,
          loggedDate: Date.now(),
          pointsEarned: 75,
          notes: "Wrong bonus",
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "resolved",
          source: "mini_game",
          externalId: `wrong_${user2}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.patch(p2._id, {
          bonusPoints: 75,
          bonusActivityId: activityId,
          outcome: { caughtPrey: true, wasCaught: false },
        });

        const uc = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user2).eq("challengeId", challengeId)
          )
          .first();
        if (uc)
          await ctx.db.patch(uc._id, { totalPoints: uc.totalPoints + 75 });
      });

      const summary = await t.mutation(
        internal.mutations.miniGameAudit.fix,
        { miniGameId: miniGameId as Id<"miniGames"> }
      );

      // user2's correct bonus is 0, so no new activity should be created
      const p2After = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect()
          .then((ps) => ps.find((p) => p.userId === user2));
      });

      expect(p2After!.bonusPoints).toBe(0);
      expect(p2After!.bonusActivityId).toBeUndefined();
    });

    it("should update totalPoints correctly after fix", async () => {
      const { miniGameId, challengeId, user1, user2 } =
        await setupCompletedGameWithBadOutcomes();

      // Record totalPoints before fix
      const beforeFix = await t.run(async (ctx) => {
        const uc1 = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user1).eq("challengeId", challengeId)
          )
          .first();
        const uc2 = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user2).eq("challengeId", challengeId)
          )
          .first();
        return { user1Points: uc1!.totalPoints, user2Points: uc2!.totalPoints };
      });

      await t.mutation(internal.mutations.miniGameAudit.fix, {});

      const afterFix = await t.run(async (ctx) => {
        const uc1 = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user1).eq("challengeId", challengeId)
          )
          .first();
        const uc2 = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user2).eq("challengeId", challengeId)
          )
          .first();
        return { user1Points: uc1!.totalPoints, user2Points: uc2!.totalPoints };
      });

      // alice: had +75 wrong, gets -25 correct → delta = -75 - 25 = -100
      expect(afterFix.user1Points).toBe(beforeFix.user1Points - 75 + -25);
      // bob: had 0, gets +75 correct → delta = +75
      expect(afterFix.user2Points).toBe(beforeFix.user2Points + 75);
    });
  });
});
