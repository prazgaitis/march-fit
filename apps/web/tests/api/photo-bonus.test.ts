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

/**
 * Tests for the daily photo bonus cap.
 *
 * Users can post multiple photos per day but only the FIRST activity
 * with a photo each day earns the +1 media bonus point.
 */
describe('Photo bonus daily cap', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  /** Set up a standard user + challenge + activity type. */
  async function setup(email = 'user@example.com') {
    const userId = await createTestUser(t, { email });
    const tAuth = t.withIdentity({ subject: `subject-${email}`, email });
    const challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);
    const activityTypeId = await createTestActivityType(t, challengeId, {
      name: 'Running',
      scoringConfig: { unit: 'minutes', pointsPerUnit: 1, basePoints: 5 },
    });
    return { userId, tAuth, challengeId, activityTypeId };
  }

  it('user gets photo bonus on first activity with photo of the day', async () => {
    const { tAuth, challengeId, activityTypeId } = await setup();

    const result = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo.jpg',
    });

    // 5 base + 10*1 metric + 1 media = 16
    expect(result.pointsEarned).toBe(16);

    const activity = await t.run(async (ctx) => ctx.db.get(result.id));
    const hasMediaBonus = activity!.triggeredBonuses?.some((b) => b.metric === 'media');
    expect(hasMediaBonus).toBe(true);
  });

  it('user does NOT get photo bonus on second activity with photo on same day', async () => {
    const { tAuth, challengeId, activityTypeId } = await setup('user2@example.com');

    // First activity with photo — should get bonus
    const first = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo1.jpg',
    });
    expect(first.pointsEarned).toBe(16); // 5 + 10 + 1

    // Second activity with photo on SAME day — should NOT get bonus
    const second = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 20 },
      source: 'manual',
      imageUrl: 'https://example.com/photo2.jpg',
    });
    expect(second.pointsEarned).toBe(25); // 5 + 20 — no media bonus

    const secondActivity = await t.run(async (ctx) => ctx.db.get(second.id));
    const hasMediaBonus = secondActivity!.triggeredBonuses?.some((b) => b.metric === 'media');
    expect(hasMediaBonus).toBeFalsy();
  });

  it('user DOES get photo bonus on a photo activity on a different day', async () => {
    const { tAuth, challengeId, activityTypeId } = await setup('user3@example.com');

    // Day 1 — earns media bonus
    await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo.jpg',
    });

    // Day 2 — should earn media bonus again (different day)
    const day2 = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-02',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo2.jpg',
    });
    expect(day2.pointsEarned).toBe(16); // 5 + 10 + 1 media bonus

    const day2Activity = await t.run(async (ctx) => ctx.db.get(day2.id));
    const hasMediaBonus = day2Activity!.triggeredBonuses?.some((b) => b.metric === 'media');
    expect(hasMediaBonus).toBe(true);
  });

  it('user without photo gets no media bonus (baseline)', async () => {
    const { tAuth, challengeId, activityTypeId } = await setup('user4@example.com');

    const result = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      // No imageUrl or mediaIds
    });

    expect(result.pointsEarned).toBe(15); // 5 + 10, no media bonus

    const activity = await t.run(async (ctx) => ctx.db.get(result.id));
    const hasMediaBonus = activity!.triggeredBonuses?.some((b) => b.metric === 'media');
    expect(hasMediaBonus).toBeFalsy();
  });

  it('photo bonus on day 1 does not affect day 2', async () => {
    const { tAuth, challengeId, activityTypeId } = await setup('user5@example.com');

    // Multiple photo activities on day 1
    await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 5 },
      source: 'manual',
      imageUrl: 'https://example.com/photo.jpg',
    });
    await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 5 },
      source: 'manual',
      imageUrl: 'https://example.com/photo2.jpg',
    });

    // Day 2 should be unaffected — still gets bonus
    const day2 = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-02',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo3.jpg',
    });

    expect(day2.pointsEarned).toBe(16); // 5 + 10 + 1

    const day2Activity = await t.run(async (ctx) => ctx.db.get(day2.id));
    const hasMediaBonus = day2Activity!.triggeredBonuses?.some((b) => b.metric === 'media');
    expect(hasMediaBonus).toBe(true);
  });

  it('user can still post multiple photos in a day, just no extra points after first', async () => {
    const { tAuth, challengeId, activityTypeId } = await setup('user6@example.com');

    const first = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo1.jpg',
    });

    const second = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo2.jpg',
    });

    const third = await tAuth.mutation(api.mutations.activities.log, {
      challengeId: challengeId as Id<'challenges'>,
      activityTypeId: activityTypeId as Id<'activityTypes'>,
      loggedDate: '2024-03-01',
      metrics: { minutes: 10 },
      source: 'manual',
      imageUrl: 'https://example.com/photo3.jpg',
    });

    // First gets media bonus, second and third do not
    expect(first.pointsEarned).toBe(16);  // 5 + 10 + 1
    expect(second.pointsEarned).toBe(15); // 5 + 10
    expect(third.pointsEarned).toBe(15);  // 5 + 10

    // All three activities exist in the database (photos still posted)
    const [act1, act2, act3] = await t.run(async (ctx) => Promise.all([
      ctx.db.get(first.id),
      ctx.db.get(second.id),
      ctx.db.get(third.id),
    ]));

    expect(act1).not.toBeNull();
    expect(act2).not.toBeNull();
    expect(act3).not.toBeNull();

    // Only first has media bonus
    expect(act1!.triggeredBonuses?.some((b) => b.metric === 'media')).toBe(true);
    expect(act2!.triggeredBonuses?.some((b) => b.metric === 'media')).toBeFalsy();
    expect(act3!.triggeredBonuses?.some((b) => b.metric === 'media')).toBeFalsy();
  });
});
