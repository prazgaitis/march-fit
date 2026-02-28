import { describe, it, expect, beforeEach } from 'vitest';
import { api, internal } from '@repo/backend';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';
import { insertTestActivity } from "../helpers/activities";

// Fixed base timestamp within the test challenge window (Jan 10 2024)
const TEST_NOW = new Date('2024-01-10T00:00:00Z').getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Mini-Games Lifecycle & Configuration', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  // Helper to create a user with participation
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

  describe('CRUD Operations', () => {
    it('should create a mini-game in draft status', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Test Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      const game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game).not.toBeNull();
      expect(game.status).toBe("draft");
      expect(game.type).toBe("partner_week");
      expect(game.name).toBe("Test Game");
    });

    it('should create mini-game with default config when none provided', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Partner week default
      const { miniGameId: pwId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });
      const pw = await t.run(async (ctx) => ctx.db.get(pwId));
      expect(pw.config).toEqual({ bonusPercentage: 10 });

      // Hunt week default
      const { miniGameId: hwId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "HW",
        startsAt: TEST_NOW + WEEK_MS,
        endsAt: TEST_NOW + 2 * WEEK_MS,
      });
      const hw = await t.run(async (ctx) => ctx.db.get(hwId));
      expect(hw.config).toEqual({ catchBonus: 75, caughtPenalty: 25 });

      // PR week default
      const { miniGameId: prId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR",
        startsAt: TEST_NOW + 2 * WEEK_MS,
        endsAt: TEST_NOW + 3 * WEEK_MS,
      });
      const pr = await t.run(async (ctx) => ctx.db.get(prId));
      expect(pr.config).toEqual({ prBonus: 100 });
    });

    it('should create mini-game with custom config', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Custom PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
        config: { bonusPercentage: 25 },
      });

      const game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game.config).toEqual({ bonusPercentage: 25 });
    });

    it('should update a draft mini-game', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Original Name",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.update, {
        miniGameId,
        name: "Updated Name",
        config: { bonusPercentage: 20 },
      });

      const game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game.name).toBe("Updated Name");
      expect(game.config).toEqual({ bonusPercentage: 20 });
    });

    it('should not allow updating a non-draft mini-game', async () => {
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
        tWithAuth.mutation(api.mutations.miniGames.update, {
          miniGameId,
          name: "Should Fail",
        })
      ).rejects.toThrow("Can only edit draft mini-games");
    });

    it('should delete a draft mini-game', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "To Delete",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.remove, { miniGameId });

      const game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game).toBeNull();
    });

    it('should not allow deleting a non-draft mini-game', async () => {
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
        tWithAuth.mutation(api.mutations.miniGames.remove, { miniGameId })
      ).rejects.toThrow("Can only delete draft mini-games");
    });
  });

  describe('Date Validation', () => {
    it('should reject start date after end date', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await expect(
        tWithAuth.mutation(api.mutations.miniGames.create, {
          challengeId,
          type: "partner_week",
          name: "Bad Dates",
          startsAt: TEST_NOW + WEEK_MS,
          endsAt: TEST_NOW,
        })
      ).rejects.toThrow("Start date must be before end date");
    });

    it('should reject game extending past challenge end date', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser); // endDate: 2024-01-31

      // Challenge end date is 2024-01-31
      const farFuture = new Date('2024-03-01T00:00:00Z').getTime();

      await expect(
        tWithAuth.mutation(api.mutations.miniGames.create, {
          challengeId,
          type: "partner_week",
          name: "Too Long",
          startsAt: TEST_NOW,
          endsAt: farFuture,
        })
      ).rejects.toThrow("Mini-game cannot extend past challenge end date");
    });

    it('should reject equal start and end dates', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await expect(
        tWithAuth.mutation(api.mutations.miniGames.create, {
          challengeId,
          type: "partner_week",
          name: "Same Day",
          startsAt: TEST_NOW,
          endsAt: TEST_NOW,
        })
      ).rejects.toThrow("Start date must be before end date");
    });
  });

  describe('Status Transitions', () => {
    it('should transition draft -> active -> calculating -> completed', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Lifecycle Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      // Draft
      let game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game.status).toBe("draft");

      // Start -> Active
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game.status).toBe("active");

      // End -> Completed (goes through calculating internally)
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });
      game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game.status).toBe("completed");
    });

    it('should not allow starting a non-draft game', async () => {
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

      // Try to start again
      await expect(
        tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId })
      ).rejects.toThrow("Can only start draft mini-games");
    });

    it('should not allow ending a non-active game', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      // Try to end a draft game
      await expect(
        tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId })
      ).rejects.toThrow("Can only end active mini-games");
    });

    it('should not start a game with no participants', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Don't add any participants to challenge

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "No Participants",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await expect(
        tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId })
      ).rejects.toThrow("No participants in challenge");
    });
  });

  describe('Authorization', () => {
    it('should allow challenge creator to manage mini-games', async () => {
      const creatorEmail = "creator@example.com";
      const creatorUser = await createTestUser(t, { email: creatorEmail, role: "user" });
      const tCreator = t.withIdentity({ subject: "creator-id", email: creatorEmail });
      const challengeId = await createTestChallenge(t, creatorUser);

      // Creator should be able to create a game
      const { miniGameId } = await tCreator.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "Creator Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      expect(miniGameId).toBeDefined();
    });

    it('should reject non-admin user from managing mini-games', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Create a regular user
      const regularEmail = "regular@example.com";
      await createTestUser(t, { email: regularEmail, role: "user", username: "regularuser" });
      const tRegular = t.withIdentity({ subject: "regular-id", email: regularEmail });

      await expect(
        tRegular.mutation(api.mutations.miniGames.create, {
          challengeId,
          type: "partner_week",
          name: "Unauthorized",
          startsAt: TEST_NOW,
          endsAt: TEST_NOW + WEEK_MS,
        })
      ).rejects.toThrow("Not authorized");
    });
  });

  describe('Queries', () => {
    it('should list all mini-games for a challenge', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Create multiple games
      await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Game 1",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Game 2",
        startsAt: TEST_NOW + WEEK_MS,
        endsAt: TEST_NOW + 2 * WEEK_MS,
      });

      const result = await t.query(api.queries.miniGames.list, { challengeId });
      expect(result.length).toBe(2);
    });

    it('should get mini-game by ID with participants', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Test Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const game = await t.query(api.queries.miniGames.getById, { miniGameId });
      expect(game).not.toBeNull();
      expect(game!.name).toBe("Test Game");
      expect(game!.participants.length).toBe(2);
    });

    it('should only return active games in getActive query', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      // Create two games
      const { miniGameId: game1Id } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Active Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Draft Game",
        startsAt: TEST_NOW + WEEK_MS,
        endsAt: TEST_NOW + 2 * WEEK_MS,
      });

      // Start only the first
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId: game1Id });

      const activeGames = await t.query(api.queries.miniGames.getActive, { challengeId });
      expect(activeGames.length).toBe(1);
      expect(activeGames[0].name).toBe("Active Game");
    });

    it('getUserHistory should return completed games with outcomes', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Completed Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const history = await t.query(api.queries.miniGames.getUserHistory, {
        challengeId,
        userId: user1,
      });
      expect(history.length).toBe(1);
      expect(history[0].miniGame.status).toBe("completed");
      expect(history[0].participation.bonusPoints).toBeDefined();
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom bonusPercentage for partner week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      // Create with 25% bonus instead of default 10%
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Custom Bonus PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
        config: { bonusPercentage: 25 },
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 200, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 gets 25% of user 2's 200 points = 50
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.bonusPoints).toBe(50);
    });

    it('should use custom catchBonus and caughtPenalty for hunt week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      // Custom: +150 for catch, -50 for being caught
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Custom Hunt",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
        config: { catchBonus: 150, caughtPenalty: 50 },
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 60, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.outcome.caughtPrey).toBe(true);
      expect(user2Participant.bonusPoints).toBe(150);
    });

    it('should use custom prBonus for PR week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR
      const beforeGameStart = TEST_NOW - 5 * DAY_MS;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      // Custom PR bonus: 200 instead of 100
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "Custom PR",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
        config: { prBonus: 200 },
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user1, challengeId, activityTypeId, 60, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.bonusPoints).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single participant in partner week (paired with self)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Solo PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      expect(participants.length).toBe(1);
      // Paired with self
      expect(participants[0].partnerUserId).toBe(user1);
    });

    it('should handle single participant in hunt week (no prey, no hunter)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Solo HW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      expect(participants.length).toBe(1);
      expect(participants[0].preyUserId).toBeUndefined();
      expect(participants[0].hunterUserId).toBeUndefined();
    });

    it('should handle PR week with no prior activities (PR = 0)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // No prior activities - PR is 0
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "No History PR",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      expect(participants[0].initialState.dailyPr).toBe(0);

      // Any activity should beat PR of 0
      await logActivity(user1, challengeId, activityTypeId, 10, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const updatedParticipants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      expect(updatedParticipants[0].outcome.hitPr).toBe(true);
      expect(updatedParticipants[0].bonusPoints).toBe(100);
    });

    it('should not count mini_game bonus activities in partner week points', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 logs real activity
      await logActivity(user2, challengeId, activityTypeId, 100, TEST_NOW + 1000);

      // Also insert a mini_game bonus activity (should be excluded from partner calc)
      await t.run(async (ctx) => {
        await ctx.db.insert("activities", {
          userId: user2,
          challengeId,
          activityTypeId,
          loggedDate: TEST_NOW + 2000,
          pointsEarned: 999,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "resolved",
          source: "mini_game",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 bonus should be 10% of 100 (real activity), NOT 10% of 1099
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.bonusPoints).toBe(10);
    });

    it('should not count mini_game activities in PR week max calculation', async () => {
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
        name: "PR",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Log 40 real points (doesn't beat PR)
      await logActivity(user1, challengeId, activityTypeId, 40, TEST_NOW + 1000);

      // Also insert a mini_game bonus activity with huge points (should be excluded)
      await t.run(async (ctx) => {
        await ctx.db.insert("activities", {
          userId: user1,
          challengeId,
          activityTypeId,
          loggedDate: TEST_NOW + 1000, // Same day
          pointsEarned: 500,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "resolved",
          source: "mini_game",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // Should only count the 40 real points, not the 500 bonus
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.outcome.weekMaxPoints).toBe(40);
      expect(user1Participant.outcome.hitPr).toBe(false);
      expect(user1Participant.bonusPoints).toBe(0);
    });

    it('should handle zero points in partner week (no bonus awarded)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "No Activity PW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      // No activities logged during game period
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 should get 0 bonus (partner earned 0)
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.bonusPoints).toBe(0);
    });

    it('should handle large number of participants in hunt week', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Create 6 participants
      const users: string[] = [];
      for (let i = 0; i < 6; i++) {
        const userId = await createUserWithParticipation(
          challengeId,
          (6 - i) * 100,
          { username: `user${i + 1}` }
        );
        users.push(userId);
      }

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Big Hunt",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      expect(participants.length).toBe(6);

      // First place: no prey, hunter is second place
      const firstPlace = participants.find((p) => p.initialState.rank === 1);
      expect(firstPlace!.preyUserId).toBeUndefined();
      expect(firstPlace!.hunterUserId).toBe(users[1]);

      // Last place: prey is 5th place, no hunter
      const lastPlace = participants.find((p) => p.initialState.rank === 6);
      expect(lastPlace!.preyUserId).toBe(users[4]);
      expect(lastPlace!.hunterUserId).toBeUndefined();

      // Middle (3rd place): prey is 2nd, hunter is 4th
      const middle = participants.find((p) => p.initialState.rank === 3);
      expect(middle!.preyUserId).toBe(users[1]);
      expect(middle!.hunterUserId).toBe(users[3]);
    });
  });

  describe('API Internal Mutations', () => {
    it('should create mini-game via internal mutation', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const challengeId = await createTestChallenge(t, adminUser);

      const result = await t.mutation(internal.mutations.apiMutations.createMiniGameForUser, {
        userId: adminUser,
        challengeId,
        type: "partner_week",
        name: "API Created Game",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      expect(result.miniGameId).toBeDefined();

      const game = await t.run(async (ctx) => ctx.db.get(result.miniGameId));
      expect(game.name).toBe("API Created Game");
      expect(game.status).toBe("draft");
      expect(game.config).toEqual({ bonusPercentage: 10 });
    });

    it('should update mini-game via internal mutation', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await t.mutation(internal.mutations.apiMutations.createMiniGameForUser, {
        userId: adminUser,
        challengeId,
        type: "hunt_week",
        name: "Original",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await t.mutation(internal.mutations.apiMutations.updateMiniGameForUser, {
        userId: adminUser,
        miniGameId,
        name: "Updated Via API",
        config: { catchBonus: 100, caughtPenalty: 50 },
      });

      const game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game.name).toBe("Updated Via API");
      expect(game.config).toEqual({ catchBonus: 100, caughtPenalty: 50 });
    });

    it('should delete mini-game via internal mutation', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const challengeId = await createTestChallenge(t, adminUser);

      const { miniGameId } = await t.mutation(internal.mutations.apiMutations.createMiniGameForUser, {
        userId: adminUser,
        challengeId,
        type: "pr_week",
        name: "To Delete",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await t.mutation(internal.mutations.apiMutations.removeMiniGameForUser, {
        userId: adminUser,
        miniGameId,
      });

      const game = await t.run(async (ctx) => ctx.db.get(miniGameId));
      expect(game).toBeNull();
    });

    it('should validate dates in internal create mutation', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const challengeId = await createTestChallenge(t, adminUser);

      await expect(
        t.mutation(internal.mutations.apiMutations.createMiniGameForUser, {
          userId: adminUser,
          challengeId,
          type: "partner_week",
          name: "Bad Dates",
          startsAt: TEST_NOW + WEEK_MS,
          endsAt: TEST_NOW,
        })
      ).rejects.toThrow("Start date must be before end date");
    });

    it('should reject update on non-draft game via internal mutation', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await t.mutation(internal.mutations.apiMutations.createMiniGameForUser, {
        userId: adminUser,
        challengeId,
        type: "partner_week",
        name: "Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      await expect(
        t.mutation(internal.mutations.apiMutations.updateMiniGameForUser, {
          userId: adminUser,
          miniGameId,
          name: "Should Fail",
        })
      ).rejects.toThrow("Can only edit draft mini-games");
    });

    it('should reject delete on non-draft game via internal mutation', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      await createUserWithParticipation(challengeId, 100, { username: 'user1' });

      const { miniGameId } = await t.mutation(internal.mutations.apiMutations.createMiniGameForUser, {
        userId: adminUser,
        challengeId,
        type: "partner_week",
        name: "Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      await expect(
        t.mutation(internal.mutations.apiMutations.removeMiniGameForUser, {
          userId: adminUser,
          miniGameId,
        })
      ).rejects.toThrow("Can only delete draft mini-games");
    });
  });

  describe('Bonus Activity Creation', () => {
    it('should create Mini-Game Bonus activity type if missing', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "HW",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // No Mini-Game Bonus activity type exists yet
      const beforeTypes = await t.run(async (ctx) => {
        return await ctx.db
          .query("activityTypes")
          .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
          .filter((q) => q.eq(q.field("name"), "Mini-Game Bonus"))
          .collect();
      });
      expect(beforeTypes.length).toBe(0);

      // End game which should create some bonus activity
      // Make user2 catch user1 to trigger bonus
      const user2 = await t.run(async (ctx) => {
        const participants = await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
        return participants.find((p) => p.userId !== user1)!.userId;
      });
      await logActivity(user2, challengeId, activityTypeId, 60, TEST_NOW + 1000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Now Mini-Game Bonus activity type should exist
      const afterTypes = await t.run(async (ctx) => {
        return await ctx.db
          .query("activityTypes")
          .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
          .filter((q) => q.eq(q.field("name"), "Mini-Game Bonus"))
          .collect();
      });
      expect(afterTypes.length).toBe(1);
      expect(afterTypes[0].contributesToStreak).toBe(false);
    });

    it('should reuse existing Mini-Game Bonus activity type', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      // Run game 1
      const { miniGameId: game1Id } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "PW 1",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId: game1Id });
      await logActivity(user2, challengeId, activityTypeId, 100, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId: game1Id });

      // Run game 2
      const { miniGameId: game2Id } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "PW 2",
        startsAt: TEST_NOW + WEEK_MS,
        endsAt: TEST_NOW + 2 * WEEK_MS,
      });
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId: game2Id });
      await logActivity(user1, challengeId, activityTypeId, 100, TEST_NOW + WEEK_MS + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId: game2Id });

      // Should still only have 1 Mini-Game Bonus activity type
      const bonusTypes = await t.run(async (ctx) => {
        return await ctx.db
          .query("activityTypes")
          .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
          .filter((q) => q.eq(q.field("name"), "Mini-Game Bonus"))
          .collect();
      });
      expect(bonusTypes.length).toBe(1);
    });

    it('should set correct external data on bonus activities', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "External Data Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 100, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Check the bonus activity for user1
      const bonusActivities = await t.run(async (ctx) => {
        return await ctx.db
          .query("activities")
          .withIndex("userId", (q) => q.eq("userId", user1))
          .filter((q) => q.eq(q.field("source"), "mini_game"))
          .collect();
      });

      expect(bonusActivities.length).toBe(1);
      expect(bonusActivities[0].externalId).toContain("mini_game_");
      expect(bonusActivities[0].externalId).toContain(user1);
    });

    it('should link bonus activity to participant record', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Link Test",
        startsAt: TEST_NOW,
        endsAt: TEST_NOW + WEEK_MS,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 100, TEST_NOW + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant!.bonusActivityId).toBeDefined();

      // Verify the linked activity exists
      const linkedActivity = await t.run(async (ctx) => {
        return await ctx.db.get(user1Participant!.bonusActivityId);
      });
      expect(linkedActivity).not.toBeNull();
      expect(linkedActivity.source).toBe("mini_game");
    });
  });
});
