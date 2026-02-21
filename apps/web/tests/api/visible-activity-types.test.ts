import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser } from '../helpers/convex';
import type { Id } from '@repo/backend/_generated/dataModel';

describe('getVisibleByChallengeId', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  const DAY_MS = 24 * 60 * 60 * 1000;

  /**
   * Create a 31-day challenge starting at a given UTC timestamp.
   * finalDaysStart defaults to 29 (days 29–31 are "Final Days").
   */
  const setupChallenge = async ({
    startUtcMs,
    finalDaysStart,
  }: {
    startUtcMs: number;
    finalDaysStart?: number;
  }) => {
    const userId = await createTestUser(t, { email: 'creator@test.com', name: 'Creator' });
    const startDate = new Date(startUtcMs).toISOString().split('T')[0]; // YYYY-MM-DD
    const endUtcMs = startUtcMs + 30 * DAY_MS;
    const endDate = new Date(endUtcMs).toISOString().split('T')[0];

    const challengeId = await t.run(async (ctx) => {
      return await ctx.db.insert('challenges', {
        name: 'Test Challenge',
        creatorId: userId,
        startDate,
        endDate,
        durationDays: 31,
        streakMinPoints: 10,
        weekCalcMethod: 'fromStart',
        ...(finalDaysStart !== undefined && { finalDaysStart }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    return { challengeId, startUtcMs };
  };

  const insertActivityType = async (
    challengeId: Id<'challenges'>,
    name: string,
    opts: {
      validWeeks?: number[];
      availableInFinalDays?: boolean;
      displayOrder?: number;
    } = {}
  ) => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert('activityTypes', {
        challengeId,
        name,
        scoringConfig: { type: 'completion', fixedPoints: 10 },
        contributesToStreak: true,
        isNegative: false,
        ...opts,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  };

  it('returns all activity types when none have validWeeks', async () => {
    const { challengeId, startUtcMs } = await setupChallenge({ startUtcMs: Date.now() - 5 * DAY_MS });
    await insertActivityType(challengeId, 'Running');
    await insertActivityType(challengeId, 'Cycling');

    const result = await t.query(api.queries.activityTypes.getVisibleByChallengeId, { challengeId });
    expect(result.map((r: any) => r.name)).toContain('Running');
    expect(result.map((r: any) => r.name)).toContain('Cycling');
  });

  it('hides activity types outside their validWeeks', async () => {
    // We're 5 days in = week 1
    const startUtcMs = Date.now() - 5 * DAY_MS;
    const { challengeId } = await setupChallenge({ startUtcMs });

    await insertActivityType(challengeId, 'Week 1 Special', { validWeeks: [1] });
    await insertActivityType(challengeId, 'Week 2 Special', { validWeeks: [2] });
    await insertActivityType(challengeId, 'Always Visible');

    const result = await t.query(api.queries.activityTypes.getVisibleByChallengeId, { challengeId });
    const names = result.map((r: any) => r.name);

    expect(names).toContain('Week 1 Special');   // in week 1 ✓
    expect(names).not.toContain('Week 2 Special'); // week 2 not started ✗
    expect(names).toContain('Always Visible');    // no validWeeks → always show ✓
  });

  it('shows availableInFinalDays activities during Final Days regardless of validWeeks', async () => {
    // Day 29 of a 31-day challenge with finalDaysStart=29
    const startUtcMs = Date.now() - 28 * DAY_MS;
    const { challengeId } = await setupChallenge({ startUtcMs, finalDaysStart: 29 });

    await insertActivityType(challengeId, 'Week 1 Final Days', {
      validWeeks: [1],
      availableInFinalDays: true,
    });
    await insertActivityType(challengeId, 'Week 1 No Final Days', {
      validWeeks: [1],
      availableInFinalDays: false,
    });
    await insertActivityType(challengeId, 'Current Week', {
      validWeeks: [5], // week 5 = days 29–35
    });

    const result = await t.query(api.queries.activityTypes.getVisibleByChallengeId, { challengeId });
    const names = result.map((r: any) => r.name);

    expect(names).toContain('Week 1 Final Days');     // availableInFinalDays overrides ✓
    expect(names).not.toContain('Week 1 No Final Days'); // blocked by validWeeks, no override ✗
    expect(names).toContain('Current Week');           // current week ✓
  });

  it('hides availableInFinalDays activities that are outside validWeeks and NOT in Final Days', async () => {
    // Day 10 — week 2 — not yet Final Days (finalDaysStart=29)
    const startUtcMs = Date.now() - 9 * DAY_MS;
    const { challengeId } = await setupChallenge({ startUtcMs, finalDaysStart: 29 });

    await insertActivityType(challengeId, 'Week 1 Final Days', {
      validWeeks: [1],
      availableInFinalDays: true,
    });

    const result = await t.query(api.queries.activityTypes.getVisibleByChallengeId, { challengeId });
    const names = result.map((r: any) => r.name);

    // Week 1 has passed, not in Final Days yet → hidden
    expect(names).not.toContain('Week 1 Final Days');
  });

  it('returns results sorted by displayOrder', async () => {
    const { challengeId } = await setupChallenge({ startUtcMs: Date.now() - 5 * DAY_MS });

    await insertActivityType(challengeId, 'C', { displayOrder: 30 });
    await insertActivityType(challengeId, 'A', { displayOrder: 10 });
    await insertActivityType(challengeId, 'B', { displayOrder: 20 });

    const result = await t.query(api.queries.activityTypes.getVisibleByChallengeId, { challengeId });
    expect(result.map((r: any) => r.name)).toEqual(['A', 'B', 'C']);
  });

});
