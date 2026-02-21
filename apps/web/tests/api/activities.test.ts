import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

describe('Activities Logic', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  describe('log mutation', () => {
    it('should log a new activity', async () => {
      // Setup
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

      // Create user participation
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

      // Create activity type
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 1,
            basePoints: 5,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const activityData = {
        challengeId,
        activityTypeId,
        loggedDate: new Date('2024-01-15').toISOString(),
        metrics: { minutes: 30 }, // 30 minutes
        notes: 'Morning run',
        source: 'manual',
      };

      // Execute
      const result = await tWithAuth.mutation(api.mutations.activities.log, activityData);

      // Assert
      expect(result.pointsEarned).toBe(35); // 5 base + 30 * 1
      
      // Verify activity in DB
      const activity = await t.run(async (ctx) => {
        return await ctx.db.get(result.id);
      });
      expect(activity.metrics.minutes).toBe(30);
      expect(activity.userId).toBe(userId);
    });

    it('should block logging when payment is required and unpaid', async () => {
      // Setup
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

      await t.run(async (ctx) => {
        await ctx.db.insert("challengePaymentConfig", {
          challengeId,
          testMode: true,
          priceInCents: 2500,
          currency: "usd",
          stripeTestSecretKey: "encrypted",
          stripeTestPublishableKey: "pk_test_123",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("userChallenges", {
          userId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "unpaid",
          updatedAt: Date.now(),
        });
      });

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 1,
            basePoints: 5,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const activityData = {
        challengeId,
        activityTypeId,
        loggedDate: new Date('2024-01-15').toISOString(),
        metrics: { minutes: 30 },
        notes: 'Morning run',
        source: 'manual',
      };

      await expect(tWithAuth.mutation(api.mutations.activities.log, activityData))
        .rejects.toThrow('Please complete payment before logging activities');
    });

    it('should require challenge participation', async () => {
      // Setup
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

      // Create activity type but NO user participation
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 1,
            basePoints: 5,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const activityData = {
        challengeId,
        activityTypeId,
        loggedDate: new Date('2024-01-15').toISOString(),
        metrics: { minutes: 30 },
        source: 'manual',
      };

      // Execute & Assert
      await expect(tWithAuth.mutation(api.mutations.activities.log, activityData))
        .rejects.toThrow('You are not part of this challenge');
    });

    it('should validate activity type belongs to challenge', async () => {
      // Setup
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      
      // Create two separate challenges
      const challenge1Id = await createTestChallenge(t, userId, { name: 'Challenge 1' });
      const challenge2Id = await createTestChallenge(t, userId, { name: 'Challenge 2' });

      // User participates in challenge1
      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId,
          challengeId: challenge1Id,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      });

      // Activity type belongs to challenge2
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId: challenge2Id,
          name: 'Running',
          scoringConfig: { unit: 'minutes', pointsPerUnit: 1 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const activityData = {
        challengeId: challenge1Id, // Trying to log for challenge1
        activityTypeId, // But activity type is for challenge2
        loggedDate: new Date('2024-01-15').toISOString(),
        metrics: { minutes: 30 },
        source: 'manual',
      };

      // Execute & Assert
      await expect(tWithAuth.mutation(api.mutations.activities.log, activityData))
        .rejects.toThrow('This activity type is not available for this challenge');
    });

    it('should calculate points correctly', async () => {
      // Setup
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Activity type with specific point calculation
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 2, // 2 points per minute
            basePoints: 10,   // Plus 10 base points
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const activityData = {
        challengeId,
        activityTypeId,
        loggedDate: new Date('2024-01-15').toISOString(),
        metrics: { minutes: 15 }, // 15 minutes
        source: 'manual',
      };

      // Execute
      const result = await tWithAuth.mutation(api.mutations.activities.log, activityData);

      // Assert
      // (15 minutes * 2 points/minute) + 10 base = 40 points
      expect(result.pointsEarned).toBe(40);
    });

    it('should treat negative activity types as penalties even when config points are negative', async () => {
      const testEmail = "negative-sign@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "negative-sign-user", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Penalty Count",
          scoringConfig: {
            unit: "count",
            pointsPerUnit: -5,
            basePoints: 0,
          },
          contributesToStreak: false,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: new Date("2024-01-15").toISOString(),
        metrics: { count: 2 },
        source: "manual",
      });

      expect(result.pointsEarned).toBe(-10);

      const participation = await t.run(async (ctx) => {
        return await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.totalPoints).toBe(-10);
    });

    it('previewScore query should match persisted score calculation', async () => {
      const testEmail = "preview-score@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "preview-score-user", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Penalty Count",
          scoringConfig: {
            unit: "count",
            pointsPerUnit: -5,
            basePoints: 0,
          },
          contributesToStreak: false,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const preview = await tWithAuth.query(api.queries.activities.previewScore, {
        challengeId,
        activityTypeId,
        loggedDate: new Date("2024-01-15").toISOString(),
        metrics: { count: 2 },
        hasMedia: false,
      });

      expect(preview).not.toBeNull();
      expect(preview!.pointsEarned).toBe(-10);

      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: new Date("2024-01-15").toISOString(),
        metrics: { count: 2 },
        source: "manual",
      });

      expect(result.pointsEarned).toBe(preview!.pointsEarned);
    });

    // TODO: Enable these tests once complex scoring logic is ported to Convex
    it.skip('should handle positive and penalty activity scoring rules');
    it.skip('should reset the drinks allowance on a new day');
    it.skip('should handle variant-based scoring');
  });

  describe('streak calculation', () => {
    // Helper to create standard test setup
    const setupStreakTest = async (streakMinPoints = 10) => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId, { streakMinPoints });

      const participationId = await t.run(async (ctx) => {
        return await ctx.db.insert("userChallenges", {
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

      // Create activity type that contributes to streak (1 point per minute)
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 1,
            basePoints: 0,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Create activity type that does NOT contribute to streak
      const nonStreakActivityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Rest Day',
          scoringConfig: {
            unit: 'count',
            pointsPerUnit: 5,
            basePoints: 0,
          },
          contributesToStreak: false,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const getParticipation = async () => {
        return await t.run(async (ctx) => {
          return await ctx.db.get(participationId);
        });
      };

      return { userId, tWithAuth, challengeId, activityTypeId, nonStreakActivityTypeId, participationId, getParticipation };
    };

    it('should start streak at 1 when first activity meets threshold', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Log 15 minutes (15 points) - meets threshold of 10
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      expect(result.streakUpdate.currentStreak).toBe(1);

      const participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
      expect(participation.lastStreakDay).toBeDefined();
    });

    it('should not start streak when activity is below threshold', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Log 5 minutes (5 points) - below threshold of 10
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 5 },
        source: 'manual',
      });

      expect(result.streakUpdate.currentStreak).toBe(0);

      const participation = await getParticipation();
      expect(participation.currentStreak).toBe(0);
      expect(participation.lastStreakDay).toBeUndefined();
    });

    it('should increment streak on consecutive days', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Day 1: Log 15 minutes
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);

      // Day 2: Log 15 minutes (consecutive day)
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      expect(result.streakUpdate.currentStreak).toBe(2);

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(2);
    });

    it('should not double-count streak for multiple activities on same day', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // First activity on day - starts streak
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T08:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);

      // Second activity on same day - should not increment streak
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T18:00:00Z',
        metrics: { minutes: 20 },
        source: 'manual',
      });

      expect(result.streakUpdate.currentStreak).toBe(1);

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
    });

    it('should reset streak after missing a day', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Day 1
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      // Day 2 (consecutive)
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(2);

      // Day 4 (skipped day 3) - should reset streak to 1
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-18T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      expect(result.streakUpdate.currentStreak).toBe(1);

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
    });

    it('should recalculate streaks when backfilling a missing day', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Day 1
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      // Day 3 (skip day 2, streak should reset to 1)
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);

      // Backfill Day 2 - should recompute streak to 3 (days 1-3)
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(3);
      expect(participation.lastStreakDay).toBe(Date.UTC(2024, 0, 17));
    });

    it('recomputes streak when backfilled negative activity drops a past day below threshold', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Build a 3-day streak.
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(3);

      const negativeTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Penalty",
          scoringConfig: {
            unit: "count",
            pointsPerUnit: 10,
            basePoints: 0,
          },
          contributesToStreak: true,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Backfill a negative activity on day 2: 15 + (-10) = 5 < threshold.
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: negativeTypeId,
        loggedDate: '2024-01-16T18:00:00Z',
        metrics: { count: 1 },
        source: 'manual',
      });

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
      expect(participation.lastStreakDay).toBe(Date.UTC(2024, 0, 17));
    });

    it('recomputes streak after editing a past day to a negative streak-contributing activity', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      const day1 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      const day2 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(3);

      const negativeTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Penalty Edit",
          scoringConfig: {
            unit: "count",
            pointsPerUnit: 10,
            basePoints: 0,
          },
          contributesToStreak: true,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Change day 2 activity from +15 to -10.
      await tWithAuth.mutation(api.mutations.activities.editActivity, {
        activityId: day2.id,
        activityTypeId: negativeTypeId,
        metrics: { count: 1 },
        loggedDate: '2024-01-16',
      });

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
      expect(participation.lastStreakDay).toBe(Date.UTC(2024, 0, 17));

      // Keep variables used and explicit.
      expect(day1.id).toBeDefined();
    });

    it('recomputes streak after deleting a past day activity', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      const day2 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(3);

      await tWithAuth.mutation(api.mutations.activities.remove, {
        activityId: day2.id,
      });

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
      expect(participation.lastStreakDay).toBe(Date.UTC(2024, 0, 17));
    });

    it('should count multiple activities on same day toward threshold', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // First activity: 5 minutes (5 points) - below threshold
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T08:00:00Z',
        metrics: { minutes: 5 },
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(0); // Not enough yet

      // Second activity: 6 minutes (6 points) - combined = 11 points, meets threshold
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T18:00:00Z',
        metrics: { minutes: 6 },
        source: 'manual',
      });

      expect(result.streakUpdate.currentStreak).toBe(1);

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(1);
    });

    it('should not count non-streak-contributing activities toward threshold', async () => {
      const { tWithAuth, challengeId, activityTypeId, nonStreakActivityTypeId, getParticipation } = await setupStreakTest(10);

      // Log non-streak activity with 20 points
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: nonStreakActivityTypeId,
        loggedDate: '2024-01-15T08:00:00Z',
        metrics: { count: 4 }, // 4 * 5 = 20 points
        source: 'manual',
      });

      let participation = await getParticipation();
      expect(participation.currentStreak).toBe(0); // Non-streak activity doesn't count

      // Log streak activity below threshold
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 5 }, // Only 5 points from streak-contributing
        source: 'manual',
      });

      participation = await getParticipation();
      expect(participation.currentStreak).toBe(0); // Still not enough streak-contributing points
    });

    it('should build a 5-day streak correctly', async () => {
      const { tWithAuth, challengeId, activityTypeId, getParticipation } = await setupStreakTest(10);

      // Log activities for 5 consecutive days
      for (let day = 15; day <= 19; day++) {
        await tWithAuth.mutation(api.mutations.activities.log, {
          challengeId,
          activityTypeId,
          loggedDate: `2024-01-${day}T10:00:00Z`,
          metrics: { minutes: 15 },
          source: 'manual',
        });
      }

      const participation = await getParticipation();
      expect(participation.currentStreak).toBe(5);
      expect(participation.totalPoints).toBe(75); // 5 days * 15 points
    });

    it('should accumulate total points correctly across activities', async () => {
      const { tWithAuth, challengeId, activityTypeId, nonStreakActivityTypeId, getParticipation } = await setupStreakTest(10);

      // Day 1: 15 points from streak activity
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      // Day 1: 20 points from non-streak activity
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: nonStreakActivityTypeId,
        loggedDate: '2024-01-15T12:00:00Z',
        metrics: { count: 4 },
        source: 'manual',
      });

      const participation = await getParticipation();
      expect(participation.totalPoints).toBe(35); // 15 + 20
      expect(participation.currentStreak).toBe(1); // Only streak activity counts
    });
  });

  describe('achievement criteria', () => {
    it('should award triathlon achievement only after all activity-type thresholds are met', async () => {
      const testEmail = "triathlete@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "triathlete", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const [runTypeId, cycleTypeId, swimTypeId] = await t.run(async (ctx) => {
        const now = Date.now();
        const runId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Run",
          scoringConfig: { unit: "miles", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        const cycleId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Cycle",
          scoringConfig: { unit: "miles", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        const swimId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Swim",
          scoringConfig: { unit: "miles", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        return [runId, cycleId, swimId];
      });

      await tWithAuth.mutation(api.mutations.achievements.createAchievement, {
        challengeId,
        name: "March Fitness Triathlon",
        description: "Complete marathon-equivalent run/cycle/swim distances",
        bonusPoints: 250,
        criteria: {
          criteriaType: "all_activity_type_thresholds",
          requirements: [
            { activityTypeId: runTypeId, metric: "distance_miles", threshold: 26.2 },
            { activityTypeId: cycleTypeId, metric: "distance_miles", threshold: 112 },
            { activityTypeId: swimTypeId, metric: "distance_miles", threshold: 2.4 },
          ],
        },
        frequency: "once_per_challenge",
      });

      const runResult = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: runTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { miles: 26.2 },
        source: 'manual',
      });
      expect(runResult.pointsEarned).toBeCloseTo(26.2, 5);

      let userAchievements = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAchievements")
          .withIndex("userId", (q) => q.eq("userId", userId))
          .collect();
      });
      expect(userAchievements).toHaveLength(0);

      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: cycleTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { miles: 112 },
        source: 'manual',
      });

      userAchievements = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAchievements")
          .withIndex("userId", (q) => q.eq("userId", userId))
          .collect();
      });
      expect(userAchievements).toHaveLength(0);

      const swimResult = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: swimTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        metrics: { miles: 2.4 },
        source: 'manual',
      });
      expect(swimResult.pointsEarned).toBeCloseTo(2.4, 5);

      userAchievements = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAchievements")
          .withIndex("userId", (q) => q.eq("userId", userId))
          .collect();
      });
      expect(userAchievements).toHaveLength(1);
      expect(userAchievements[0].qualifyingActivityIds).toHaveLength(3);

      const participation = await t.run(async (ctx) => {
        return await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation).not.toBeNull();
      expect(participation!.totalPoints).toBeCloseTo(390.6, 5);

      expect(userAchievements[0].bonusActivityId).toBeDefined();
      const bonusActivity = await t.run(async (ctx) => {
        return await ctx.db.get(userAchievements[0].bonusActivityId!);
      });
      expect(bonusActivity).not.toBeNull();
      expect(bonusActivity!.pointsEarned).toBe(250);
    });

    it('should include achievement bonus points in challenge leaderboard ranking', async () => {
      const testEmail = "triathlete-leaderboard@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "triathlete-leaderboard", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

      const rivalId = await createTestUser(t, {
        email: "rival@example.com",
        username: "rival",
        name: "Rival",
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

        await ctx.db.insert("userChallenges", {
          userId: rivalId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 200,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      });

      const [runTypeId, cycleTypeId, swimTypeId] = await t.run(async (ctx) => {
        const now = Date.now();
        const runId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Run",
          scoringConfig: { unit: "miles", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        const cycleId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Cycle",
          scoringConfig: { unit: "miles", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        const swimId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Swim",
          scoringConfig: { unit: "miles", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        return [runId, cycleId, swimId];
      });

      await tWithAuth.mutation(api.mutations.achievements.createAchievement, {
        challengeId,
        name: "March Fitness Triathlon",
        description: "Run 26.2 + Swim 2.4 + Cycle 112",
        bonusPoints: 250,
        criteria: {
          criteriaType: "all_activity_type_thresholds",
          requirements: [
            { activityTypeId: runTypeId, metric: "distance_miles", threshold: 26.2 },
            { activityTypeId: cycleTypeId, metric: "distance_miles", threshold: 112 },
            { activityTypeId: swimTypeId, metric: "distance_miles", threshold: 2.4 },
          ],
        },
        frequency: "once_per_challenge",
      });

      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: runTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { miles: 26.2 },
        source: 'manual',
      });

      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: cycleTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { miles: 112 },
        source: 'manual',
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("activities", {
          userId: rivalId,
          challengeId,
          activityTypeId: runTypeId,
          loggedDate: Date.parse("2024-01-16T12:00:00Z"),
          metrics: { miles: 200 },
          source: "manual",
          pointsEarned: 200,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const beforeBonusLeaderboard = await t.query(
        api.queries.participations.getChallengeLeaderboard,
        { challengeId, paginationOpts: { numItems: 10, cursor: null } }
      );
      const beforeUserEntry = beforeBonusLeaderboard.page.find((entry) => entry.user.id === userId);
      expect(beforeUserEntry).toBeDefined();
      expect(beforeUserEntry!.totalPoints).toBeCloseTo(138.2, 5);
      expect(beforeUserEntry!.rank).toBe(2);

      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: swimTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        metrics: { miles: 2.4 },
        source: 'manual',
      });

      const afterBonusLeaderboard = await t.query(
        api.queries.participations.getChallengeLeaderboard,
        { challengeId, paginationOpts: { numItems: 10, cursor: null } }
      );
      const afterUserEntry = afterBonusLeaderboard.page.find((entry) => entry.user.id === userId);
      expect(afterUserEntry).toBeDefined();
      expect(afterUserEntry!.totalPoints).toBeCloseTo(390.6, 5);
      expect(afterUserEntry!.rank).toBe(1);
    });
  });

  describe('maxPerChallenge enforcement', () => {
    it('should allow logging up to maxPerChallenge limit', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Create activity type with maxPerChallenge = 2
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'One-time Bonus',
          scoringConfig: { type: 'completion', fixedPoints: 25 },
          contributesToStreak: false,
          isNegative: false,
          maxPerChallenge: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // First log should succeed
      const result1 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        source: 'manual',
      });
      expect(result1.pointsEarned).toBe(25);

      // Second log should succeed
      const result2 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        source: 'manual',
      });
      expect(result2.pointsEarned).toBe(25);

      // Third log should fail
      await expect(tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-17T10:00:00Z',
        source: 'manual',
      })).rejects.toThrow('You\'ve reached the limit of 2');
    });

    it('should enforce one-time bonus (maxPerChallenge = 1)', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Create one-time activity type
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Sally-up Challenge',
          scoringConfig: { type: 'completion', fixedPoints: 40 },
          contributesToStreak: true,
          isNegative: false,
          maxPerChallenge: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // First log succeeds
      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        source: 'manual',
      });

      // Second log fails
      await expect(tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        source: 'manual',
      })).rejects.toThrow('You\'ve already logged "Sally-up Challenge"');
    });
  });

  describe('validWeeks enforcement', () => {
    it('should allow logging during valid weeks', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });

      // Create challenge starting on Jan 1, 2024
      const challengeId = await t.run(async (ctx) => {
        return await ctx.db.insert("challenges", {
          name: 'Test Challenge',
          creatorId: userId,
          startDate: "2024-01-01", // Jan 1, 2024
          endDate: "2024-01-28", // 4 weeks
          streakMinPoints: 10,
          durationDays: 28,
          weekCalcMethod: 'fromStart',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
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

      // Create activity type valid only in week 2
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Week 2 Special',
          scoringConfig: { type: 'completion', fixedPoints: 25 },
          contributesToStreak: false,
          isNegative: false,
          validWeeks: [2],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Week 2 (Jan 8-14) should succeed
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-10T10:00:00Z', // Day 10, Week 2
        source: 'manual',
      });
      expect(result.pointsEarned).toBe(25);
    });

    it('should reject logging during invalid weeks', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });

      // Create challenge starting on Jan 1, 2024
      const challengeId = await t.run(async (ctx) => {
        return await ctx.db.insert("challenges", {
          name: 'Test Challenge',
          creatorId: userId,
          startDate: "2024-01-01", // Jan 1, 2024
          endDate: "2024-01-28", // 4 weeks
          streakMinPoints: 10,
          durationDays: 28,
          weekCalcMethod: 'fromStart',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
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

      // Create activity type valid only in week 3
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Week 3 Only',
          scoringConfig: { type: 'completion', fixedPoints: 25 },
          contributesToStreak: false,
          isNegative: false,
          validWeeks: [3],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Week 1 (Jan 1-7) should fail
      await expect(tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-03T10:00:00Z', // Day 3, Week 1
        source: 'manual',
      })).rejects.toThrow('is only available during week 3');

      // Week 2 (Jan 8-14) should fail
      await expect(tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-10T10:00:00Z', // Day 10, Week 2
        source: 'manual',
      })).rejects.toThrow('is only available during week 3');
    });
  });

  describe('tiered scoring', () => {
    it('should calculate tiered points correctly', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Create tiered activity type (like burpee challenge)
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Burpee Challenge',
          scoringConfig: {
            type: 'tiered',
            metric: 'duration_minutes',
            tiers: [
              { maxValue: 10, points: 50 },
              { maxValue: 12, points: 30 },
              { points: 10 }, // Default for > 12 min
            ],
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Under 10 minutes = 50 points
      const result1 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { duration_minutes: 8 },
        source: 'manual',
      });
      expect(result1.pointsEarned).toBe(50);
    });

    it('should fall through to lower tiers', async () => {
      const testEmail = "test2@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id-2", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Burpee Challenge',
          scoringConfig: {
            type: 'tiered',
            metric: 'duration_minutes',
            tiers: [
              { maxValue: 10, points: 50 },
              { maxValue: 12, points: 30 },
              { points: 10 },
            ],
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Between 10-12 minutes = 30 points
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { duration_minutes: 11 },
        source: 'manual',
      });
      expect(result.pointsEarned).toBe(30);
    });
  });

  describe('unit-based scoring with cap', () => {
    it('should cap points at maxUnits', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Create activity type with maxUnits (like The Max)
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'The Max',
          scoringConfig: {
            type: 'unit_based',
            unit: 'circuits',
            pointsPerUnit: 20,
            maxUnits: 3,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Logging 5 circuits should be capped at 3 * 20 = 60 points
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { circuits: 5 },
        source: 'manual',
      });
      expect(result.pointsEarned).toBe(60); // Capped at 3 circuits
    });

    it('should allow points under the cap', async () => {
      const testEmail = "test2@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id-2", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'The Max',
          scoringConfig: {
            type: 'unit_based',
            unit: 'circuits',
            pointsPerUnit: 20,
            maxUnits: 3,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Logging 2 circuits = 2 * 20 = 40 points
      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { circuits: 2 },
        source: 'manual',
      });
      expect(result.pointsEarned).toBe(40);
    });
  });

  describe('optional bonuses', () => {
    it('should add optional bonus points when selected', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Create activity type with optional bonuses (like The Murph)
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'The Murph',
          scoringConfig: {
            type: 'completion',
            fixedPoints: 65,
            optionalBonuses: [
              { name: 'Weighted Vest', bonusPoints: 40, description: 'Completed with 20lb weighted vest' },
            ],
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Without optional bonus
      const result1 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        source: 'manual',
      });
      expect(result1.pointsEarned).toBe(65);

      // With optional bonus selected
      const result2 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { selectedBonuses: ['Weighted Vest'] },
        source: 'manual',
      });
      expect(result2.pointsEarned).toBe(105); // 65 + 40
    });
  });

  describe('threshold bonuses', () => {
    it('should add bonus points for distance thresholds', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      // Create running activity type with marathon bonus
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Outdoor Run',
          scoringConfig: {
            type: 'unit_based',
            unit: 'miles',
            pointsPerUnit: 7.5,
          },
          bonusThresholds: [
            { metric: 'distance_miles', threshold: 13.1, bonusPoints: 25, description: 'Half Marathon bonus' },
            { metric: 'distance_miles', threshold: 26.2, bonusPoints: 100, description: 'Marathon bonus' },
          ],
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Regular 5 mile run - no bonus
      const result1 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15T10:00:00Z',
        metrics: { miles: 5 },
        source: 'manual',
      });
      expect(result1.pointsEarned).toBe(37.5); // 5 * 7.5
      expect(result1.bonusPoints).toBe(0);

      // Half marathon - gets 25 bonus
      const result2 = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16T10:00:00Z',
        metrics: { miles: 13.1 },
        source: 'manual',
      });
      expect(result2.basePoints).toBeCloseTo(98.25, 1); // 13.1 * 7.5
      expect(result2.bonusPoints).toBe(25);
      expect(result2.pointsEarned).toBeCloseTo(123.25, 1);
    });

    it('should exclude deleted activities from drink scoring', async () => {
      const testEmail = "test@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-id", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Drinks',
          scoringConfig: {
            unit: 'drinks',
            pointsPerUnit: 1,
            freebiesPerDay: 1,
          },
          contributesToStreak: false,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const day = new Date('2024-01-15T12:00:00Z');
      await t.run(async (ctx) => {
        await ctx.db.insert("activities", {
          userId,
          challengeId,
          activityTypeId,
          loggedDate: day.getTime(),
          metrics: { drinks: 2 },
          source: "manual",
          pointsEarned: -2,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          deletedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: day.toISOString(),
        metrics: { drinks: 2 },
        source: "manual",
      });

      expect(result.pointsEarned).toBe(-1);
    });

    it('should preserve negative totals when deleting a positive activity', async () => {
      const testEmail = "negative-total@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "negative-total-user", email: testEmail });
      const challengeId = await createTestChallenge(t, userId);

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

      const [runTypeId, drinksTypeId] = await t.run(async (ctx) => {
        const runId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Running",
          scoringConfig: { unit: "minutes", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const drinksId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Drinks",
          scoringConfig: { unit: "count", pointsPerUnit: 10, basePoints: 0 },
          contributesToStreak: false,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        return [runId, drinksId];
      });

      const run = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: runTypeId,
        loggedDate: "2024-01-15T10:00:00Z",
        metrics: { minutes: 5 },
        source: "manual",
      });

      await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId: drinksTypeId,
        loggedDate: "2024-01-15T18:00:00Z",
        metrics: { count: 1 },
        source: "manual",
      });

      await tWithAuth.mutation(api.mutations.activities.remove, {
        activityId: run.id,
      });

      const participation = await t.run(async (ctx) =>
        ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first()
      );
      expect(participation!.totalPoints).toBe(-10);

      const otherUserId = await createTestUser(t, { email: "other-negative-total@example.com" });
      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId: otherUserId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 999,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });

        await ctx.db.insert("activities", {
          userId: otherUserId,
          challengeId,
          activityTypeId: drinksTypeId,
          loggedDate: Date.parse("2024-01-15T18:00:00Z"),
          metrics: { count: 1 },
          source: "manual",
          pointsEarned: -6,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const leaderboard = await t.query(api.queries.participations.getFullLeaderboard, {
        challengeId,
      });

      expect(leaderboard[0].user.id).toBe(otherUserId);
      expect(leaderboard[0].totalPoints).toBe(-6);
      expect(leaderboard[1].user.id).toBe(userId);
      expect(leaderboard[1].totalPoints).toBe(-10);
    });
  });
});
