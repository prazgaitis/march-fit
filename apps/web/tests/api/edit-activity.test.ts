import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestActivityType,
  createTestParticipation,
} from '../helpers/convex';
import type { Id } from '@repo/backend/_generated/dataModel';

describe('editActivity mutation', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  async function setupBasic() {
    const email = 'owner@example.com';
    const userId = await createTestUser(t, { email });
    const tAuth = t.withIdentity({ subject: 'owner-subject', email });
    const challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);

    const activityTypeId = await createTestActivityType(t, challengeId, {
      name: 'Running',
      scoringConfig: { unit: 'minutes', pointsPerUnit: 1, basePoints: 5 },
    });

    // Log an initial activity
    const logResult = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-01-15',
      metrics: { minutes: 30 },
      notes: 'Original notes',
      source: 'manual',
    });

    return { userId, tAuth, challengeId, activityTypeId, activityId: logResult.id, logResult };
  }

  it('user can edit their own activity (notes, metrics, loggedDate)', async () => {
    const { tAuth, activityId } = await setupBasic();

    const result = await tAuth.mutation(api.mutations.activities.editActivity, {
      activityId: activityId as Id<'activities'>,
      notes: 'Updated notes',
      metrics: { minutes: 45 },
      loggedDate: '2024-01-16',
    });

    expect(result.success).toBe(true);

    // Check activity was updated
    const activity = await t.run(async (ctx) => ctx.db.get(activityId as Id<'activities'>));
    expect(activity!.notes).toBe('Updated notes');
    expect((activity!.metrics as Record<string, unknown>)['minutes']).toBe(45);
    expect(activity!.loggedDate).toBe(new Date('2024-01-16').getTime());
  });

  it('points are recalculated correctly after metric change', async () => {
    const { tAuth, activityId } = await setupBasic();

    // Original: 30 minutes * 1 + 5 base = 35 pts
    // New: 60 minutes * 1 + 5 base = 65 pts
    const result = await tAuth.mutation(api.mutations.activities.editActivity, {
      activityId: activityId as Id<'activities'>,
      metrics: { minutes: 60 },
    });

    expect(result.pointsEarned).toBe(65);
  });

  it('participation.totalPoints is updated correctly (old subtracted, new added)', async () => {
    const { tAuth, activityId, userId, challengeId } = await setupBasic();

    // Original points = 35
    const before = await t.run(async (ctx) =>
      ctx.db
        .query('userChallenges')
        .withIndex('userChallengeUnique', (q) =>
          q.eq('userId', userId as Id<'users'>).eq('challengeId', challengeId as Id<'challenges'>)
        )
        .first()
    );
    expect(before!.totalPoints).toBe(35);

    // Edit to 60 minutes => 65 pts
    await tAuth.mutation(api.mutations.activities.editActivity, {
      activityId: activityId as Id<'activities'>,
      metrics: { minutes: 60 },
    });

    const after = await t.run(async (ctx) =>
      ctx.db
        .query('userChallenges')
        .withIndex('userChallengeUnique', (q) =>
          q.eq('userId', userId as Id<'users'>).eq('challengeId', challengeId as Id<'challenges'>)
        )
        .first()
    );
    // 35 - 35 + 65 = 65
    expect(after!.totalPoints).toBe(65);
  });

  it('user CANNOT edit another user\'s activity', async () => {
    const { activityId } = await setupBasic();

    // Create a different user
    const otherEmail = 'other@example.com';
    await createTestUser(t, { email: otherEmail });
    const tOther = t.withIdentity({ subject: 'other-subject', email: otherEmail });

    await expect(
      tOther.mutation(api.mutations.activities.editActivity, {
        activityId: activityId as Id<'activities'>,
        notes: 'Hacked!',
      })
    ).rejects.toThrow('Not authorized to edit this activity');
  });

  it('user CANNOT edit a deleted activity', async () => {
    const { tAuth, activityId } = await setupBasic();

    // Delete it first
    await tAuth.mutation(api.mutations.activities.remove, {
      activityId: activityId as Id<'activities'>,
    });

    await expect(
      tAuth.mutation(api.mutations.activities.editActivity, {
        activityId: activityId as Id<'activities'>,
        notes: 'Should fail',
      })
    ).rejects.toThrow('Cannot edit a deleted activity');
  });

  it('changing activityTypeId to one from a different challenge should throw', async () => {
    const { tAuth, activityId, userId } = await setupBasic();

    // Create a different challenge with its own activity type
    const otherChallengeId = await createTestChallenge(t, userId, {
      name: 'Other Challenge',
    });
    const otherTypeId = await createTestActivityType(t, otherChallengeId, {
      name: 'Swimming',
    });

    await expect(
      tAuth.mutation(api.mutations.activities.editActivity, {
        activityId: activityId as Id<'activities'>,
        activityTypeId: otherTypeId as Id<'activityTypes'>,
      })
    ).rejects.toThrow('does not belong to the same challenge');
  });

  it('editing with no changes (same values) still returns success', async () => {
    const { tAuth, activityId } = await setupBasic();

    const result = await tAuth.mutation(api.mutations.activities.editActivity, {
      activityId: activityId as Id<'activities'>,
    });

    expect(result.success).toBe(true);
  });
});
