import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { Id } from '@repo/backend/_generated/dataModel';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

describe('Activity Type Category Assignment', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  const setup = async () => {
    const userId = await createTestUser(t, {
      email: 'admin@example.com',
      username: 'admin',
      role: 'admin',
    });
    const challengeId = await createTestChallenge(t, userId);

    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Cardio',
        sortOrder: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const categoryId2 = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Strength',
        sortOrder: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    return { userId, challengeId, categoryId, categoryId2 };
  };

  it('createActivityType stores categoryId', async () => {
    const { challengeId, categoryId } = await setup();

    const activityTypeId = await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Running',
      scoringConfig: { basePoints: 5 },
      contributesToStreak: true,
      isNegative: false,
      categoryId: categoryId as Id<'categories'>,
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored).not.toBeNull();
    expect(stored!.categoryId).toBe(categoryId);
  });

  it('createActivityType without categoryId leaves it undefined', async () => {
    const { challengeId } = await setup();

    const activityTypeId = await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Stretching',
      scoringConfig: { basePoints: 2 },
      contributesToStreak: false,
      isNegative: false,
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored).not.toBeNull();
    expect(stored!.categoryId).toBeUndefined();
  });

  it('updateActivityType can set categoryId', async () => {
    const { challengeId, categoryId } = await setup();

    const activityTypeId = await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Cycling',
      scoringConfig: { basePoints: 3 },
      contributesToStreak: true,
      isNegative: false,
    });

    await t.mutation(api.mutations.activityTypes.updateActivityType, {
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      categoryId: categoryId as Id<'categories'>,
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored!.categoryId).toBe(categoryId);
  });

  it('updateActivityType can change categoryId', async () => {
    const { challengeId, categoryId, categoryId2 } = await setup();

    const activityTypeId = await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Swimming',
      scoringConfig: { basePoints: 4 },
      contributesToStreak: true,
      isNegative: false,
      categoryId: categoryId as Id<'categories'>,
    });

    await t.mutation(api.mutations.activityTypes.updateActivityType, {
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      categoryId: categoryId2 as Id<'categories'>,
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored!.categoryId).toBe(categoryId2);
  });

  it('categories.getAll returns all categories', async () => {
    const { categoryId, categoryId2 } = await setup();

    const categories = await t.query(api.queries.categories.getAll, {});
    expect(categories).toHaveLength(2);

    const ids = categories.map((c: { _id: string }) => c._id);
    expect(ids).toContain(categoryId);
    expect(ids).toContain(categoryId2);
  });

  it('categories.getChallengeCategories returns only categories used in a challenge', async () => {
    const { challengeId, categoryId } = await setup();

    // Create activity type with categoryId
    await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Running',
      scoringConfig: { basePoints: 5 },
      contributesToStreak: true,
      isNegative: false,
      categoryId: categoryId as Id<'categories'>,
    });

    // Create activity type without category
    await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Yoga',
      scoringConfig: { basePoints: 2 },
      contributesToStreak: false,
      isNegative: false,
    });

    const challengeCategories = await t.query(api.queries.categories.getChallengeCategories, {
      challengeId: challengeId as Id<'challenges'>,
    });

    expect(challengeCategories).toHaveLength(1);
    expect(challengeCategories[0]._id).toBe(categoryId);
  });

  it('categories.createCategory creates a category via public mutation', async () => {
    const { userId } = await setup();
    const tWithAuth = t.withIdentity({ subject: "admin-user", email: "admin@example.com" });

    const categoryId = await tWithAuth.mutation(api.mutations.categories.createCategory, {
      name: "Wellness",
      description: "Mind + body",
      sortOrder: 3,
      showInCategoryLeaderboard: true,
    });

    const stored = await t.run(async (ctx) => ctx.db.get(categoryId));
    expect(stored).not.toBeNull();
    expect(stored!.name).toBe("Wellness");
    expect(stored!.description).toBe("Mind + body");
    expect(stored!.sortOrder).toBe(3);
    expect(stored!.showInCategoryLeaderboard).toBe(true);
    expect(stored!.createdAt).toBeTypeOf("number");
    expect(stored!.updatedAt).toBeTypeOf("number");
  });
});
