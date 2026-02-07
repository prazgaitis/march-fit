import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

describe('Mini-Games Scoring', () => {
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
        username: overrides.username || `user_${Date.now()}`,
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

  // Helper to create an activity type for a challenge
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

  // Helper to log an activity for a user
  const logActivity = async (
    userId: string,
    challengeId: string,
    activityTypeId: string,
    pointsEarned: number,
    loggedDate: number
  ) => {
    return await t.run(async (ctx) => {
      const activityId = await ctx.db.insert("activities", {
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

      // Update user's total points
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

  describe('Partner Week', () => {
    it('should pair participants correctly (1st with last, 2nd with 2nd-last)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Create 4 participants with different points
      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      const user2 = await createUserWithParticipation(challengeId, 75, { username: 'user2' });  // Rank 2
      const user3 = await createUserWithParticipation(challengeId, 50, { username: 'user3' });  // Rank 3
      const user4 = await createUserWithParticipation(challengeId, 25, { username: 'user4' });  // Rank 4

      // Create a partner week mini-game
      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Partner Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      // Start the game
      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Check pairings
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 (rank 1) should be paired with User 4 (rank 4)
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.partnerUserId).toBe(user4);

      // User 2 (rank 2) should be paired with User 3 (rank 3)
      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.partnerUserId).toBe(user3);

      // User 3 (rank 3) should be paired with User 2 (rank 2)
      const user3Participant = participants.find((p) => p.userId === user3);
      expect(user3Participant.partnerUserId).toBe(user2);

      // User 4 (rank 4) should be paired with User 1 (rank 1)
      const user4Participant = participants.find((p) => p.userId === user4);
      expect(user4Participant.partnerUserId).toBe(user1);
    });

    it('should pair middle participant with self when odd number', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Create 3 participants
      await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });  // Rank 2 (middle)
      await createUserWithParticipation(challengeId, 25, { username: 'user3' });  // Rank 3

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Partner Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // Middle user (rank 2) should be paired with themselves
      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.partnerUserId).toBe(user2);
    });

    it('should calculate bonus as 10% of partner week points', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      // Create 2 participants
      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const now = Date.now();
      const gameStart = now;
      const gameEnd = now + 7 * 24 * 60 * 60 * 1000;

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Partner Week #1",
        startsAt: gameStart,
        endsAt: gameEnd,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 1's partner (user 2) logs 200 points during the week
      await logActivity(user2, challengeId, activityTypeId, 200, gameStart + 1000);

      // User 2's partner (user 1) logs 100 points during the week
      await logActivity(user1, challengeId, activityTypeId, 100, gameStart + 1000);

      // End the game
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Check bonuses
      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 gets 10% of user 2's 200 points = 20
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.bonusPoints).toBe(20);
      expect(user1Participant.outcome.partnerWeekPoints).toBe(200);

      // User 2 gets 10% of user 1's 100 points = 10
      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.bonusPoints).toBe(10);
      expect(user2Participant.outcome.partnerWeekPoints).toBe(100);
    });

    it('should create bonus activities for participants', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Partner Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await logActivity(user2, challengeId, activityTypeId, 100, now + 1000);
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Check that bonus activity was created
      const bonusActivities = await t.run(async (ctx) => {
        return await ctx.db
          .query("activities")
          .withIndex("userId", (q) => q.eq("userId", user1))
          .filter((q) => q.eq(q.field("source"), "mini_game"))
          .collect();
      });

      expect(bonusActivities.length).toBe(1);
      expect(bonusActivities[0].pointsEarned).toBe(10); // 10% of 100
      expect(bonusActivities[0].source).toBe("mini_game");
    });
  });

  describe('Hunt Week', () => {
    it('should assign prey (person above) and hunter (person below)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      // Create 4 participants with different points
      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      const user2 = await createUserWithParticipation(challengeId, 75, { username: 'user2' });  // Rank 2
      const user3 = await createUserWithParticipation(challengeId, 50, { username: 'user3' });  // Rank 3
      const user4 = await createUserWithParticipation(challengeId, 25, { username: 'user4' });  // Rank 4

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 (rank 1): No prey, hunter is user 2
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.preyUserId).toBeUndefined();
      expect(user1Participant.hunterUserId).toBe(user2);

      // User 2 (rank 2): Prey is user 1, hunter is user 3
      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.preyUserId).toBe(user1);
      expect(user2Participant.hunterUserId).toBe(user3);

      // User 3 (rank 3): Prey is user 2, hunter is user 4
      const user3Participant = participants.find((p) => p.userId === user3);
      expect(user3Participant.preyUserId).toBe(user2);
      expect(user3Participant.hunterUserId).toBe(user4);

      // User 4 (rank 4): Prey is user 3, no hunter
      const user4Participant = participants.find((p) => p.userId === user4);
      expect(user4Participant.preyUserId).toBe(user3);
      expect(user4Participant.hunterUserId).toBeUndefined();
    });

    it('should award +75 for catching prey', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      // User 1 starts with 100 points, User 2 starts with 50 points
      await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });  // Rank 2

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 logs enough points to pass user 1 (catches prey)
      // User 2 needs > 100 total, currently has 50, so logs 60 more = 110 total
      await logActivity(user2, challengeId, activityTypeId, 60, now + 1000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 2 caught their prey (user 1)
      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.outcome.caughtPrey).toBe(true);
      expect(user2Participant.bonusPoints).toBe(75);
    });

    it('should penalize -25 for being caught', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      // User 1 has 100, User 2 has 50
      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });  // Rank 2

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 catches user 1 (passes them)
      await logActivity(user2, challengeId, activityTypeId, 60, now + 1000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // User 1 was caught by user 2
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.outcome.wasCaught).toBe(true);
      expect(user1Participant.bonusPoints).toBe(-25);
    });

    it('should award +50 net for catching prey AND being caught', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      // Create 3 participants: User1 (100), User2 (50), User3 (25)
      await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });  // Rank 2
      const user3 = await createUserWithParticipation(challengeId, 25, { username: 'user3' });  // Rank 3

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 catches user 1 (prey) by logging 60 points -> total 110
      // User 3 catches user 2 (hunter catches them) by logging 100 points -> total 125
      await logActivity(user2, challengeId, activityTypeId, 60, now + 1000);
      await logActivity(user3, challengeId, activityTypeId, 100, now + 2000);

      // Final standings: User3 (125), User2 (110), User1 (100)
      // User 2: caught prey (user1), was caught by hunter (user3)

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user2Participant = participants.find((p) => p.userId === user2);
      expect(user2Participant.outcome.caughtPrey).toBe(true);
      expect(user2Participant.outcome.wasCaught).toBe(true);
      expect(user2Participant.bonusPoints).toBe(50); // +75 - 25 = +50
    });

    it('should give first place no prey to hunt', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' }); // Rank 1
      await createUserWithParticipation(challengeId, 50, { username: 'user2' });  // Rank 2

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "hunt_week",
        name: "Hunt Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });
      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      // First place has no prey, can't catch anyone
      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.preyUserId).toBeUndefined();
      expect(user1Participant.outcome.caughtPrey).toBe(false);
      // First place wasn't caught either (no one passed them)
      expect(user1Participant.outcome.wasCaught).toBe(false);
      expect(user1Participant.bonusPoints).toBe(0);
    });
  });

  describe('PR Week', () => {
    it('should capture initial daily PR correctly', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Log activities before game starts to establish PR
      const beforeGameStart = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      // Day 1: 30 points
      await logActivity(user1, challengeId, activityTypeId, 30, beforeGameStart);

      // Day 2: 50 points (this should be the PR)
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart + 24 * 60 * 60 * 1000);

      // Day 3: 20 points
      await logActivity(user1, challengeId, activityTypeId, 20, beforeGameStart + 2 * 24 * 60 * 60 * 1000);

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.initialState.dailyPr).toBe(50);
    });

    it('should award +100 for hitting PR', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR of 50 before game
      const beforeGameStart = Date.now() - 10 * 24 * 60 * 60 * 1000;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      const now = Date.now();
      const gameStart = now;
      const gameEnd = now + 7 * 24 * 60 * 60 * 1000;

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR Week #1",
        startsAt: gameStart,
        endsAt: gameEnd,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Log 60 points in one day during the game (beats PR of 50)
      await logActivity(user1, challengeId, activityTypeId, 60, gameStart + 1000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.outcome.hitPr).toBe(true);
      expect(user1Participant.outcome.weekMaxPoints).toBe(60);
      expect(user1Participant.bonusPoints).toBe(100);
    });

    it('should award 0 for not hitting PR', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR of 50 before game
      const beforeGameStart = Date.now() - 10 * 24 * 60 * 60 * 1000;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      const now = Date.now();
      const gameStart = now;
      const gameEnd = now + 7 * 24 * 60 * 60 * 1000;

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR Week #1",
        startsAt: gameStart,
        endsAt: gameEnd,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Log only 40 points (doesn't beat PR of 50)
      await logActivity(user1, challengeId, activityTypeId, 40, gameStart + 1000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.outcome.hitPr).toBe(false);
      expect(user1Participant.outcome.weekMaxPoints).toBe(40);
      expect(user1Participant.bonusPoints).toBe(0);
    });

    it('should require strictly greater than PR (not equal)', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR of 50
      const beforeGameStart = Date.now() - 10 * 24 * 60 * 60 * 1000;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      const now = Date.now();
      const gameStart = now;
      const gameEnd = now + 7 * 24 * 60 * 60 * 1000;

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR Week #1",
        startsAt: gameStart,
        endsAt: gameEnd,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Log exactly 50 (ties PR but doesn't beat it)
      await logActivity(user1, challengeId, activityTypeId, 50, gameStart + 1000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.outcome.hitPr).toBe(false);
      expect(user1Participant.bonusPoints).toBe(0);
    });

    it('should calculate daily max from multiple activities on same day', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 0, { username: 'user1' });

      // Establish PR of 50 before game
      const beforeGameStart = Date.now() - 10 * 24 * 60 * 60 * 1000;
      await logActivity(user1, challengeId, activityTypeId, 50, beforeGameStart);

      const now = Date.now();
      const gameStart = now;
      const gameEnd = now + 7 * 24 * 60 * 60 * 1000;

      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "pr_week",
        name: "PR Week #1",
        startsAt: gameStart,
        endsAt: gameEnd,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // Log multiple activities on same day that together exceed PR
      // 30 + 25 = 55 > 50
      await logActivity(user1, challengeId, activityTypeId, 30, gameStart + 1000);
      await logActivity(user1, challengeId, activityTypeId, 25, gameStart + 2000);

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", miniGameId))
          .collect();
      });

      const user1Participant = participants.find((p) => p.userId === user1);
      expect(user1Participant.outcome.weekMaxPoints).toBe(55);
      expect(user1Participant.outcome.hitPr).toBe(true);
      expect(user1Participant.bonusPoints).toBe(100);
    });
  });

  describe('Total Points Update', () => {
    it('should update user total points after bonus is awarded', async () => {
      const adminUser = await createTestUser(t, { email: "admin@example.com", role: "admin" });
      const tWithAuth = t.withIdentity({ subject: "admin-user-id", email: "admin@example.com" });
      const challengeId = await createTestChallenge(t, adminUser);
      const activityTypeId = await createActivityType(challengeId);

      const user1 = await createUserWithParticipation(challengeId, 100, { username: 'user1' });
      const user2 = await createUserWithParticipation(challengeId, 50, { username: 'user2' });

      const now = Date.now();
      const { miniGameId } = await tWithAuth.mutation(api.mutations.miniGames.create, {
        challengeId,
        type: "partner_week",
        name: "Partner Week #1",
        startsAt: now,
        endsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      await tWithAuth.mutation(api.mutations.miniGames.start, { miniGameId });

      // User 2 logs 100 points, so user 1 gets 10 bonus
      await logActivity(user2, challengeId, activityTypeId, 100, now + 1000);

      // Get user 1's points before ending game
      const beforeEnd = await t.run(async (ctx) => {
        const participation = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user1).eq("challengeId", challengeId)
          )
          .first();
        return participation.totalPoints;
      });

      await tWithAuth.mutation(api.mutations.miniGames.end, { miniGameId });

      // Get user 1's points after ending game
      const afterEnd = await t.run(async (ctx) => {
        const participation = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", user1).eq("challengeId", challengeId)
          )
          .first();
        return participation.totalPoints;
      });

      // User 1 should have gained 10 bonus points
      expect(afterEnd - beforeEnd).toBe(10);
    });
  });
});
