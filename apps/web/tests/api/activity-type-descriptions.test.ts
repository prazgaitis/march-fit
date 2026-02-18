import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { Id } from '@repo/backend/_generated/dataModel';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

describe('Activity Type Description Mutations', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  const setup = async () => {
    const userId = await createTestUser(t, {
      email: 'admin@example.com',
      username: 'admin',
      role: 'admin',
    });
    const challengeId = await createTestChallenge(t, userId);
    return { userId, challengeId };
  };

  it('creates an activity type with a description', async () => {
    const { challengeId } = await setup();

    const activityTypeId = await t.run(async (ctx) => {
      return await ctx.db.insert('activityTypes', {
        challengeId: challengeId as Id<'challenges'>,
        name: 'Running',
        description: 'Log your **outdoor runs** for points. Supports markdown.',
        scoringConfig: { basePoints: 5 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored).not.toBeNull();
    expect(stored!.description).toBe('Log your **outdoor runs** for points. Supports markdown.');
  });

  it('updateActivityType persists a description change', async () => {
    const { challengeId } = await setup();

    // Create without description
    const activityTypeId = await t.run(async (ctx) => {
      return await ctx.db.insert('activityTypes', {
        challengeId: challengeId as Id<'challenges'>,
        name: 'Cycling',
        scoringConfig: { basePoints: 3 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Update with a description
    await t.mutation(api.mutations.activityTypes.updateActivityType, {
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      description: 'Earn points for every **km** cycled.',
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored!.description).toBe('Earn points for every **km** cycled.');
  });

  it('createActivityType mutation stores description', async () => {
    const { challengeId } = await setup();

    const activityTypeId = await t.mutation(api.mutations.activityTypes.createActivityType, {
      challengeId: challengeId as Id<'challenges'>,
      name: 'Yoga',
      description: 'Mindful movement for recovery points.',
      scoringConfig: { basePoints: 2 },
      contributesToStreak: false,
      isNegative: false,
    });

    const stored = await t.run(async (ctx) => ctx.db.get(activityTypeId));
    expect(stored).not.toBeNull();
    expect(stored!.description).toBe('Mindful movement for recovery points.');
    expect(stored!.name).toBe('Yoga');
  });
});
