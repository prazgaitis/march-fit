import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';
import type { Id } from '@repo/backend/_generated/dataModel';

describe('getWeeklyCategoryLeaderboard', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  // Helper: create a 28-day challenge starting Jan 1, 2024
  const setupChallenge = async () => {
    const userId = await createTestUser(t, { email: 'creator@example.com', name: 'Creator' });
    const challengeId = await t.run(async (ctx) => {
      return await ctx.db.insert('challenges', {
        name: 'Test Challenge',
        creatorId: userId,
        startDate: '2024-01-01',
        endDate: '2024-01-28',
        durationDays: 28,
        streakMinPoints: 10,
        weekCalcMethod: 'fromStart',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    return { creatorId: userId, challengeId };
  };

  // Helper: create a category
  const createCategory = async (name: string) => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  // Helper: create an activity type linked to a category
  const createActivityType = async (
    challengeId: Id<'challenges'>,
    name: string,
    categoryId?: Id<'categories'>,
  ) => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert('activityTypes', {
        challengeId,
        name,
        categoryId,
        scoringConfig: { unit: 'minutes', pointsPerUnit: 1, basePoints: 0 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  // Helper: create a user with participation
  const createParticipant = async (
    challengeId: Id<'challenges'>,
    email: string,
    name: string,
  ) => {
    const userId = await createTestUser(t, { email, name, username: email.split('@')[0] });
    await t.run(async (ctx) => {
      await ctx.db.insert('userChallenges', {
        userId,
        challengeId,
        joinedAt: Date.now(),
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: 'paid',
        updatedAt: Date.now(),
      });
    });
    return userId;
  };

  // Helper: insert an activity directly (bypassing mutation for speed)
  const insertActivity = async (
    userId: Id<'users'>,
    challengeId: Id<'challenges'>,
    activityTypeId: Id<'activityTypes'>,
    loggedDate: number,
    pointsEarned: number,
  ) => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert('activities', {
        userId,
        challengeId,
        activityTypeId,
        loggedDate,
        metrics: {},
        source: 'manual',
        pointsEarned,
        flagged: false,
        adminCommentVisibility: 'internal',
        resolutionStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  it('should return null for a non-existent challenge', async () => {
    const fakeId = '0'.repeat(32) as Id<'challenges'>;
    // convex-test will throw or return null for non-existent docs
    // We need a valid-looking ID; use a real one from setup then delete it
    const { challengeId } = await setupChallenge();
    await t.run(async (ctx) => {
      await ctx.db.delete(challengeId);
    });

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });
    expect(result).toBeNull();
  });

  it('should return empty categories when no activities exist', async () => {
    const { challengeId } = await setupChallenge();

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.weekNumber).toBe(1);
    expect(result!.totalWeeks).toBe(4); // 28 days / 7 = 4 weeks
    expect(result!.categories).toEqual([]);
  });

  it('should return correct totalWeeks and weekNumber metadata', async () => {
    const { challengeId } = await setupChallenge();

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 3,
    });

    expect(result!.weekNumber).toBe(3);
    expect(result!.totalWeeks).toBe(4);
  });

  it('should clamp weekNumber to valid range', async () => {
    const { challengeId } = await setupChallenge();

    // Week 0 should clamp to 1
    const low = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 0,
    });
    expect(low!.weekNumber).toBe(1);

    // Week 99 should clamp to totalWeeks (4)
    const high = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 99,
    });
    expect(high!.weekNumber).toBe(4);
  });

  it('should group activities by category and sum points per user', async () => {
    const { challengeId } = await setupChallenge();
    const cardioCategory = await createCategory('Cardio');
    const strengthCategory = await createCategory('Strength');
    const runningType = await createActivityType(challengeId, 'Running', cardioCategory);
    const liftingType = await createActivityType(challengeId, 'Lifting', strengthCategory);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');
    const bob = await createParticipant(challengeId, 'bob@test.com', 'Bob');

    // Week 1: Jan 1-7, 2024
    // Alice: 30 running + 20 running = 50 cardio, 15 lifting = 15 strength
    await insertActivity(alice, challengeId, runningType, Date.UTC(2024, 0, 2), 30);
    await insertActivity(alice, challengeId, runningType, Date.UTC(2024, 0, 3), 20);
    await insertActivity(alice, challengeId, liftingType, Date.UTC(2024, 0, 2), 15);

    // Bob: 40 running = 40 cardio, 25 lifting = 25 strength
    await insertActivity(bob, challengeId, runningType, Date.UTC(2024, 0, 4), 40);
    await insertActivity(bob, challengeId, liftingType, Date.UTC(2024, 0, 4), 25);

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    expect(result!.categories).toHaveLength(2);

    // Categories should be sorted alphabetically
    const cardio = result!.categories.find((c: any) => c.category.name === 'Cardio');
    const strength = result!.categories.find((c: any) => c.category.name === 'Strength');

    expect(cardio).toBeDefined();
    expect(strength).toBeDefined();

    // Cardio: Alice 50, Bob 40
    expect(cardio!.entries).toHaveLength(2);
    expect(cardio!.entries[0].user.name).toBe('Alice');
    expect(cardio!.entries[0].weeklyPoints).toBe(50);
    expect(cardio!.entries[0].rank).toBe(1);
    expect(cardio!.entries[1].user.name).toBe('Bob');
    expect(cardio!.entries[1].weeklyPoints).toBe(40);
    expect(cardio!.entries[1].rank).toBe(2);

    // Strength: Bob 25, Alice 15
    expect(strength!.entries).toHaveLength(2);
    expect(strength!.entries[0].user.name).toBe('Bob');
    expect(strength!.entries[0].weeklyPoints).toBe(25);
    expect(strength!.entries[1].user.name).toBe('Alice');
    expect(strength!.entries[1].weeklyPoints).toBe(15);
  });

  it('should only include activities from the requested week', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);
    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');

    // Week 1 activity (Jan 1-7)
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 3), 100);
    // Week 2 activity (Jan 8-14)
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 10), 200);

    // Query week 1: should only see 100 pts
    const week1 = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });
    expect(week1!.categories).toHaveLength(1);
    expect(week1!.categories[0].entries[0].weeklyPoints).toBe(100);

    // Query week 2: should only see 200 pts
    const week2 = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 2,
    });
    expect(week2!.categories).toHaveLength(1);
    expect(week2!.categories[0].entries[0].weeklyPoints).toBe(200);

    // Query week 3: no activities
    const week3 = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 3,
    });
    expect(week3!.categories).toHaveLength(0);
  });

  it('should handle uncategorized activity types', async () => {
    const { challengeId } = await setupChallenge();
    // Activity type with no categoryId
    const actType = await createActivityType(challengeId, 'Misc Workout');
    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');

    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 50);

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    expect(result!.categories).toHaveLength(1);
    expect(result!.categories[0].category.name).toBe('Other');
    expect(result!.categories[0].category.id).toBe('uncategorized');
    expect(result!.categories[0].entries[0].weeklyPoints).toBe(50);
  });

  it('should sort categories alphabetically with "Other" last', async () => {
    const { challengeId } = await setupChallenge();
    const zCategory = await createCategory('Zzz Sleep');
    const aCategory = await createCategory('Abs');

    const zType = await createActivityType(challengeId, 'Sleep Tracking', zCategory);
    const aType = await createActivityType(challengeId, 'Crunches', aCategory);
    const uncatType = await createActivityType(challengeId, 'Misc');

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');

    await insertActivity(alice, challengeId, zType, Date.UTC(2024, 0, 2), 10);
    await insertActivity(alice, challengeId, aType, Date.UTC(2024, 0, 2), 10);
    await insertActivity(alice, challengeId, uncatType, Date.UTC(2024, 0, 2), 10);

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    expect(result!.categories).toHaveLength(3);
    expect(result!.categories[0].category.name).toBe('Abs');
    expect(result!.categories[1].category.name).toBe('Zzz Sleep');
    expect(result!.categories[2].category.name).toBe('Other'); // Last
  });

  it('should rank users by points descending within a category', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');
    const bob = await createParticipant(challengeId, 'bob@test.com', 'Bob');
    const carol = await createParticipant(challengeId, 'carol@test.com', 'Carol');

    // Carol: 100, Alice: 75, Bob: 50
    await insertActivity(carol, challengeId, actType, Date.UTC(2024, 0, 2), 100);
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 75);
    await insertActivity(bob, challengeId, actType, Date.UTC(2024, 0, 2), 50);

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    const entries = result!.categories[0].entries;
    expect(entries[0].user.name).toBe('Carol');
    expect(entries[0].rank).toBe(1);
    expect(entries[0].weeklyPoints).toBe(100);

    expect(entries[1].user.name).toBe('Alice');
    expect(entries[1].rank).toBe(2);
    expect(entries[1].weeklyPoints).toBe(75);

    expect(entries[2].user.name).toBe('Bob');
    expect(entries[2].rank).toBe(3);
    expect(entries[2].weeklyPoints).toBe(50);
  });

  it('should limit to top 10 users per category', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    // Create 12 participants
    const userIds: Id<'users'>[] = [];
    for (let i = 0; i < 12; i++) {
      const userId = await createParticipant(
        challengeId,
        `user${i}@test.com`,
        `User ${i}`,
      );
      userIds.push(userId);
      await insertActivity(userId, challengeId, actType, Date.UTC(2024, 0, 2), (12 - i) * 10);
    }

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    expect(result!.categories[0].entries).toHaveLength(10);
    // Top user should have 120 pts, 10th should have 30 pts
    expect(result!.categories[0].entries[0].weeklyPoints).toBe(120);
    expect(result!.categories[0].entries[9].weeklyPoints).toBe(30);
  });

  it('should not include categories with zero entries', async () => {
    const { challengeId } = await setupChallenge();
    const cardio = await createCategory('Cardio');
    const strength = await createCategory('Strength');

    // Create activity types for both categories but only log to cardio
    await createActivityType(challengeId, 'Running', cardio);
    const liftingType = await createActivityType(challengeId, 'Lifting', strength);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');
    // Only cardio activities in week 1... but using liftingType, let's use a cardio type
    // Actually, let's create activities with the running type but we need its ID
    const runningType = await createActivityType(challengeId, 'Sprinting', cardio);
    await insertActivity(alice, challengeId, runningType, Date.UTC(2024, 0, 2), 50);

    // No activities for strength category

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    // Only Cardio should appear, not Strength
    expect(result!.categories).toHaveLength(1);
    expect(result!.categories[0].category.name).toBe('Cardio');
  });

  it('should aggregate multiple activities of same type for same user in same week', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);
    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');

    // Three runs in week 1 across different days
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 1), 10);
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 3), 20);
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 5), 30);

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    expect(result!.categories[0].entries[0].weeklyPoints).toBe(60); // 10 + 20 + 30
  });

  it('should aggregate activities of different types in the same category', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const running = await createActivityType(challengeId, 'Running', category);
    const cycling = await createActivityType(challengeId, 'Cycling', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice');

    await insertActivity(alice, challengeId, running, Date.UTC(2024, 0, 2), 30);
    await insertActivity(alice, challengeId, cycling, Date.UTC(2024, 0, 3), 20);

    const result = await t.query(api.queries.participations.getWeeklyCategoryLeaderboard, {
      challengeId,
      weekNumber: 1,
    });

    // Both should roll up into the Cardio category
    expect(result!.categories).toHaveLength(1);
    expect(result!.categories[0].category.name).toBe('Cardio');
    expect(result!.categories[0].entries[0].weeklyPoints).toBe(50);
  });
});
