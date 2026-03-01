import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';
import { insertTestActivity } from "../helpers/activities";

const TEST_NOW = new Date('2024-01-10T00:00:00Z').getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Mini-Games Preview (Dry Run)', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  const createUserWithParticipation = async (
    challengeId: string,
    totalPoints: number,
    overrides: { username?: string; name?: string; email?: string } = {}
  ) => {
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: overrides.email || `${overrides.username || 'user'}@example.com`,
        name: overrides.name || "Test User",
        username: overrides.username || `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
        name: 'Running',
        scoringConfig: { unit: 'minutes', pointsPerUnit: 1, basePoints: 0 },
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
    loggedDate: number
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
        source: "manual",
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

  describe('previewStart', () => {
    it('should preview partner week assignments', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1', name: 'Alice' });
      const user2 = await createUserWithParticipation(challengeId, 75, { username: 'user2', name: 'Bob' });
      const user3 = await createUserWithParticipation(challengeId, 50, { username: 'user3', name: 'Charlie' });
      const user4 = await createUserWithParticipation(challengeId, 25, { username: 'user4', name: 'Diana' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Partner Preview",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });

      expect(preview.type).toBe("partner_week");
      expect(preview.participantCount).toBe(4);
      expect(preview.assignments.length).toBe(4);

      // Rank 1 (user1, 100pts) pairs with Rank 4 (user4, 25pts)
      expect(preview.assignments[0].userId).toBe(user1);
      expect(preview.assignments[0].partnerUserId).toBe(user4);
      expect(preview.assignments[0].rank).toBe(1);
      expect(preview.assignments[0].user?.name).toBe('Alice');
      expect(preview.assignments[0].partnerUser?.name).toBe('Diana');

      // Rank 2 (user2, 75pts) pairs with Rank 3 (user3, 50pts)
      expect(preview.assignments[1].userId).toBe(user2);
      expect(preview.assignments[1].partnerUserId).toBe(user3);
    });

    it('should preview hunt week assignments', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 75, { username: 'user2' });
      const user3 = await createUserWithParticipation(challengeId, 50, { username: 'user3' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Preview",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });

      expect(preview.type).toBe("hunt_week");
      expect(preview.assignments.length).toBe(3);

      // Rank 1: no prey, hunted by rank 2
      expect(preview.assignments[0].userId).toBe(user1);
      expect(preview.assignments[0].preyUserId).toBeUndefined();
      expect(preview.assignments[0].hunterUserId).toBe(user2);

      // Rank 2: prey is rank 1, hunted by rank 3
      expect(preview.assignments[1].userId).toBe(user2);
      expect(preview.assignments[1].preyUserId).toBe(user1);
      expect(preview.assignments[1].hunterUserId).toBe(user3);

      // Rank 3: prey is rank 2, no hunter
      expect(preview.assignments[2].userId).toBe(user3);
      expect(preview.assignments[2].preyUserId).toBe(user2);
      expect(preview.assignments[2].hunterUserId).toBeUndefined();
    });

    it('should preview PR week with daily PR snapshots', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR of 50
      const beforeGame = TEST_NOW - 5 * DAY_MS;
      await logActivity(user1, challengeId, activityTypeId, 30, beforeGame);
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGame + DAY_MS);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR Preview",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });

      expect(preview.type).toBe("pr_week");
      expect(preview.assignments[0].dailyPr).toBe(50);
    });

    it('should match real start result exactly', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Fidelity Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      // Get preview
      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });

      // Now actually start
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Get real participants
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // Verify preview matches real
      expect(preview.assignments.length).toBe(participants.length);

      for (const assignment of preview.assignments) {
        const real = participants.find((p) => p.userId === assignment.userId);
        expect(real).toBeDefined();
        expect(real!.initialState.rank).toBe(assignment.rank);
        expect(real!.initialState.points).toBe(assignment.points);
        expect(real!.partnerUserId).toBe(assignment.partnerUserId);
      }
    });

    it('should match real hunt week start exactly', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      await createUserWithParticipation(challengeId, 75, { username: 'user2' });
      await createUserWithParticipation(challengeId, 50, { username: 'user3' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Fidelity",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      for (const assignment of preview.assignments) {
        const real = participants.find((p) => p.userId === assignment.userId);
        expect(real!.preyUserId).toBe(assignment.preyUserId);
        expect(real!.hunterUserId).toBe(assignment.hunterUserId);
      }
    });

    it('should reject preview for non-draft game', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      await expect(
        t.query(api.queries.miniGames.previewStart, { miniGameId })
      ).rejects.toThrow("Can only preview start for draft mini-games");
    });

    it('should reject preview with no participants', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Empty",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await expect(
        t.query(api.queries.miniGames.previewStart, { miniGameId })
      ).rejects.toThrow("No participants in challenge");
    });

    it('should include user details in preview', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await createUserWithParticipation(challengeId, 100, { username: 'alice', name: 'Alice Johnson' });
      await createUserWithParticipation(challengeId, 50, { username: 'bob', name: 'Bob Smith' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "User Details Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });

      // Should have user detail objects
      expect(preview.assignments[0].user).not.toBeNull();
      expect(preview.assignments[0].user!.username).toBe('alice');
      expect(preview.assignments[0].user!.name).toBe('Alice Johnson');
      expect(preview.assignments[0].partnerUser).not.toBeNull();
      expect(preview.assignments[0].partnerUser!.username).toBe('bob');
    });

    it('should include config in preview response', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Config Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
        config: { catchBonus: 150, caughtPenalty: 50 },
      });

      const preview = await t.query(api.queries.miniGames.previewStart, { miniGameId });

      expect(preview.config).toEqual({ catchBonus: 150, caughtPenalty: 50 });
    });
  });

  describe('previewEnd', () => {
    it('should preview partner week outcomes', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "PW End Preview",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 logs 200 points during the week
      await logActivity(user2, challengeId, activityTypeId, 200, TEST_NOW + 1000);
      // User 1 logs 100 points during the week
      await logActivity(user1, challengeId, activityTypeId, 100, TEST_NOW + 1000);

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });

      expect(preview.type).toBe("partner_week");
      expect(preview.outcomes.length).toBe(2);

      // User 1 gets 10% of user 2's 200 points = 20
      const user1Outcome = preview.outcomes.find((o) => o.userId === user1);
      expect(user1Outcome!.partnerWeekPoints).toBe(200);
      expect(user1Outcome!.bonusPoints).toBe(20);

      // User 2 gets 10% of user 1's 100 points = 10
      const user2Outcome = preview.outcomes.find((o) => o.userId === user2);
      expect(user2Outcome!.partnerWeekPoints).toBe(100);
      expect(user2Outcome!.bonusPoints).toBe(10);

      // Total bonus
      expect(preview.totalBonusPoints).toBe(30);
    });

    it('should preview hunt week outcomes', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "HW End Preview",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 catches user 1
      await logActivity(user2, challengeId, activityTypeId, 60, TEST_NOW + 1000);

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });

      expect(preview.type).toBe("hunt_week");

      const user1Outcome = preview.outcomes.find((o) => o.userId === user1);
      expect(user1Outcome!.wasCaught).toBe(true);
      expect(user1Outcome!.caughtPrey).toBe(false);
      expect(user1Outcome!.bonusPoints).toBe(-25);

      const user2Outcome = preview.outcomes.find((o) => o.userId === user2);
      expect(user2Outcome!.caughtPrey).toBe(true);
      expect(user2Outcome!.wasCaught).toBe(false);
      expect(user2Outcome!.bonusPoints).toBe(75);
    });

    it('should preview PR week outcomes', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR of 50
      const beforeGameStart = TEST_NOW - 5 * DAY_MS;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR End Preview",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Beat PR with 60 points
      await logActivity(user1, challengeId, activityTypeId, 60, TEST_NOW + 1000);

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });

      expect(preview.type).toBe("pr_week");
      const user1Outcome = preview.outcomes.find((o) => o.userId === user1);
      expect(user1Outcome!.initialPr).toBe(50);
      expect(user1Outcome!.weekMaxPoints).toBe(60);
      expect(user1Outcome!.hitPr).toBe(true);
      expect(user1Outcome!.bonusPoints).toBe(100);
    });

    it('previewEnd should match real end result exactly for partner week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Fidelity PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 200, TEST_NOW + 1000);
      await logActivity(user1, challengeId, activityTypeId, 100, TEST_NOW + 1000);

      // Preview first
      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });

      // Then actually end
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Get real participants
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // Verify preview matches real
      for (const outcome of preview.outcomes) {
        const real = participants.find((p) => p.userId === outcome.userId);
        expect(real!.bonusPoints).toBe(outcome.bonusPoints);
        expect(real!.outcome.partnerWeekPoints).toBe(outcome.partnerWeekPoints);
      }
    });

    it('previewEnd should match real end result exactly for hunt week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });
      const user3 = await createUserWithParticipation(challengeId, 25, { username: 'user3' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Fidelity HW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 60, TEST_NOW + 1000);
      await logActivity(user3, challengeId, activityTypeId, 100, TEST_NOW + 2000);

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      for (const outcome of preview.outcomes) {
        const real = participants.find((p) => p.userId === outcome.userId);
        expect(real!.bonusPoints).toBe(outcome.bonusPoints);
        expect(real!.outcome.caughtPrey).toBe(outcome.caughtPrey);
        expect(real!.outcome.wasCaught).toBe(outcome.wasCaught);
      }
    });

    it('previewEnd should match real end result exactly for PR week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      const beforeGameStart = TEST_NOW - 5 * DAY_MS;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "Fidelity PR",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user1, challengeId, activityTypeId, 60, TEST_NOW + 1000);

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      for (const outcome of preview.outcomes) {
        const real = participants.find((p) => p.userId === outcome.userId);
        expect(real!.bonusPoints).toBe(outcome.bonusPoints);
        expect(real!.outcome.hitPr).toBe(outcome.hitPr);
        expect(real!.outcome.weekMaxPoints).toBe(outcome.weekMaxPoints);
      }
    });

    it('should reject preview for non-active game', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Draft Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await expect(
        t.query(api.queries.miniGames.previewEnd, { miniGameId })
      ).rejects.toThrow("Can only preview end for active mini-games");
    });

    it('should show zero bonus when no activities in period', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "No Activity",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });
      expect(preview.totalBonusPoints).toBe(0);
      for (const outcome of preview.outcomes) {
        expect(outcome.bonusPoints).toBe(0);
      }
    });

    it('should use custom config values in preview', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      // 25% bonus instead of default 10%
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Custom Config",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
        config: { bonusPercentage: 25 },
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 200, TEST_NOW + 1000);

      const preview = await t.query(api.queries.miniGames.previewEnd, { miniGameId });
      const user1Outcome = preview.outcomes.find((o) => o.userId === user1);
      // 25% of 200 = 50
      expect(user1Outcome!.bonusPoints).toBe(50);
    });
  });
});
