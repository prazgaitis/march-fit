import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser } from '../helpers/convex';
import type { Id } from '@repo/backend/_generated/dataModel';

describe('getCumulativeCategoryLeaderboard', () => {
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
    gender?: 'male' | 'female',
  ) => {
    const userId = await createTestUser(t, {
      email,
      name,
      username: email.split('@')[0],
      ...(gender ? { gender } : {}),
    });
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

  // Helper: insert an activity directly
  const insertActivity = async (
    userId: Id<'users'>,
    challengeId: Id<'challenges'>,
    activityTypeId: Id<'activityTypes'>,
    loggedDate: number,
    pointsEarned: number,
    deletedAt?: number,
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
        deletedAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  it('should return null for a non-existent challenge', async () => {
    const { challengeId } = await setupChallenge();
    await t.run(async (ctx) => {
      await ctx.db.delete(challengeId);
    });

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });
    expect(result).toBeNull();
  });

  it('should return empty categories when no activities exist', async () => {
    const { challengeId } = await setupChallenge();

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    expect(result).not.toBeNull();
    expect(result!.categories).toEqual([]);
  });

  it('should split users by gender: female → women, male → men', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');
    const bob = await createParticipant(challengeId, 'bob@test.com', 'Bob', 'male');

    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 50);
    await insertActivity(bob, challengeId, actType, Date.UTC(2024, 0, 2), 40);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    expect(result!.categories).toHaveLength(1);
    const cardio = result!.categories[0];

    expect(cardio.women).toHaveLength(1);
    expect(cardio.women[0].user.name).toBe('Alice');
    expect(cardio.women[0].totalPoints).toBe(50);
    expect(cardio.women[0].rank).toBe(1);

    expect(cardio.men).toHaveLength(1);
    expect(cardio.men[0].user.name).toBe('Bob');
    expect(cardio.men[0].totalPoints).toBe(40);
    expect(cardio.men[0].rank).toBe(1);

    expect(cardio.noGender).toHaveLength(0);
  });

  it('should place users with no gender into noGender', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    // No gender passed → noGender
    const charlie = await createParticipant(challengeId, 'charlie@test.com', 'Charlie');
    await insertActivity(charlie, challengeId, actType, Date.UTC(2024, 0, 2), 30);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    const cardio = result!.categories[0];
    expect(cardio.women).toHaveLength(0);
    expect(cardio.men).toHaveLength(0);
    expect(cardio.noGender).toHaveLength(1);
    expect(cardio.noGender[0].user.name).toBe('Charlie');
    expect(cardio.noGender[0].rank).toBe(1);
  });

  it('should aggregate points cumulatively across ALL activities (not weekly)', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');

    // Activities across multiple "weeks"
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 50);  // week 1
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 10), 75); // week 2
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 18), 25); // week 3

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    const cardio = result!.categories[0];
    expect(cardio.women[0].totalPoints).toBe(150); // 50 + 75 + 25
  });

  it('should ignore deleted activities', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');
    const bob = await createParticipant(challengeId, 'bob@test.com', 'Bob', 'male');

    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 100);
    // Alice's second activity is deleted — should not count
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 3), 999, Date.now());
    await insertActivity(bob, challengeId, actType, Date.UTC(2024, 0, 2), 50);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    const cardio = result!.categories[0];
    expect(cardio.women[0].totalPoints).toBe(100);
    expect(cardio.men[0].totalPoints).toBe(50);
  });

  it('should limit to top 5 per gender per category', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    // Create 7 female and 7 male participants
    for (let i = 0; i < 7; i++) {
      const f = await createParticipant(
        challengeId,
        `female${i}@test.com`,
        `Female ${i}`,
        'female',
      );
      const m = await createParticipant(
        challengeId,
        `male${i}@test.com`,
        `Male ${i}`,
        'male',
      );
      await insertActivity(f, challengeId, actType, Date.UTC(2024, 0, 2), (7 - i) * 10);
      await insertActivity(m, challengeId, actType, Date.UTC(2024, 0, 2), (7 - i) * 10);
    }

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    const cardio = result!.categories[0];
    expect(cardio.women).toHaveLength(5);
    expect(cardio.men).toHaveLength(5);

    // Top female should have most points
    expect(cardio.women[0].totalPoints).toBe(70);
    expect(cardio.women[4].totalPoints).toBe(30);
    expect(cardio.men[0].totalPoints).toBe(70);
    expect(cardio.men[4].totalPoints).toBe(30);
  });

  it('should rank entries within each gender group separately', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Strength');
    const actType = await createActivityType(challengeId, 'Lifting', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');
    const carol = await createParticipant(challengeId, 'carol@test.com', 'Carol', 'female');
    const bob = await createParticipant(challengeId, 'bob@test.com', 'Bob', 'male');

    // Carol beats Alice in women; Bob is #1 in men
    await insertActivity(carol, challengeId, actType, Date.UTC(2024, 0, 2), 200);
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 100);
    await insertActivity(bob, challengeId, actType, Date.UTC(2024, 0, 2), 150);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    const strength = result!.categories[0];

    // Women ranking
    expect(strength.women[0].user.name).toBe('Carol');
    expect(strength.women[0].rank).toBe(1);
    expect(strength.women[1].user.name).toBe('Alice');
    expect(strength.women[1].rank).toBe(2);

    // Men ranking
    expect(strength.men[0].user.name).toBe('Bob');
    expect(strength.men[0].rank).toBe(1);
  });

  it('should sort categories alphabetically with "Other" last', async () => {
    const { challengeId } = await setupChallenge();
    const zCategory = await createCategory('Zzz Sleep');
    const aCategory = await createCategory('Abs');

    const zType = await createActivityType(challengeId, 'Sleep Tracking', zCategory);
    const aType = await createActivityType(challengeId, 'Crunches', aCategory);
    const uncatType = await createActivityType(challengeId, 'Misc');

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');

    await insertActivity(alice, challengeId, zType, Date.UTC(2024, 0, 2), 10);
    await insertActivity(alice, challengeId, aType, Date.UTC(2024, 0, 2), 10);
    await insertActivity(alice, challengeId, uncatType, Date.UTC(2024, 0, 2), 10);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    expect(result!.categories).toHaveLength(3);
    expect(result!.categories[0].category.name).toBe('Abs');
    expect(result!.categories[1].category.name).toBe('Zzz Sleep');
    expect(result!.categories[2].category.name).toBe('Other');
    expect(result!.categories[2].category.id).toBe('uncategorized');
  });

  it('should aggregate activities across different types in the same category', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const running = await createActivityType(challengeId, 'Running', category);
    const cycling = await createActivityType(challengeId, 'Cycling', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');

    await insertActivity(alice, challengeId, running, Date.UTC(2024, 0, 2), 30);
    await insertActivity(alice, challengeId, cycling, Date.UTC(2024, 0, 5), 20);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    expect(result!.categories).toHaveLength(1);
    expect(result!.categories[0].women[0].totalPoints).toBe(50);
  });

  it('should include gender field on user objects', async () => {
    const { challengeId } = await setupChallenge();
    const category = await createCategory('Cardio');
    const actType = await createActivityType(challengeId, 'Running', category);

    const alice = await createParticipant(challengeId, 'alice@test.com', 'Alice', 'female');
    await insertActivity(alice, challengeId, actType, Date.UTC(2024, 0, 2), 50);

    const result = await t.query(api.queries.participations.getCumulativeCategoryLeaderboard, {
      challengeId,
    });

    const entry = result!.categories[0].women[0];
    expect(entry.user).toHaveProperty('gender');
    expect(entry.user.gender).toBe('female');
  });
});
