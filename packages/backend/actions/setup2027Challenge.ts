"use node";

/**
 * Create March Fitness 2027 challenge, clone all activity types from 2026,
 * and create draft mini-games for weeks 2-4.
 *
 * Run with:
 *   npx convex run actions/setup2027Challenge:setup2027Challenge --prod
 */

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const SOURCE_CHALLENGE = "March Fitness 2026";
const CHALLENGE_START = "2027-03-01";
const CHALLENGE_END = "2027-03-30";
const DAY_MS = 24 * 60 * 60 * 1000;

export const setup2027Challenge = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find the source challenge
    const challenges = await ctx.runQuery(api.queries.challenges.listPublic, {
      limit: 100,
      offset: 0,
    });

    const sourcePublic = challenges.find((c: any) => c.name === SOURCE_CHALLENGE);
    if (!sourcePublic) throw new Error(`${SOURCE_CHALLENGE} not found`);

    const existing = challenges.find(
      (c: any) => c.name === "March Fitness 2027",
    );
    if (existing) {
      throw new Error(
        "March Fitness 2027 already exists! Delete it first if you want to re-create.",
      );
    }

    // Get full challenge details (includes creatorId)
    const source = await ctx.runQuery(api.queries.challenges.getById, {
      challengeId: sourcePublic.id as Id<"challenges">,
    });
    if (!source) throw new Error(`Could not load ${SOURCE_CHALLENGE} details`);

    // Get source activity types
    const sourceTypes = await ctx.runQuery(
      api.queries.activityTypes.getByChallengeId,
      { challengeId: sourcePublic.id as Id<"challenges"> },
    );

    console.log(
      `Found ${sourceTypes.length} activity types in ${SOURCE_CHALLENGE}`,
    );

    // ── Create challenge ──────────────────────────────────────
    console.log("Creating March Fitness 2027...");
    const challengeId = await ctx.runMutation(
      internal.mutations.challenges.create,
      {
        name: "March Fitness 2027",
        description:
          "The ultimate fitness challenge! Join hundreds of participants for 30 days of fitness, competition, and community.",
        creatorId: source.creatorId as Id<"users">,
        startDate: CHALLENGE_START,
        endDate: CHALLENGE_END,
        durationDays: 29,
        streakMinPoints: 10,
        weekCalcMethod: "sunday",
        createdAt: now,
        updatedAt: now,
      },
    );
    console.log(`✅ Created challenge: ${challengeId}`);

    // ── Clone all activity types ──────────────────────────────
    let cloned = 0;

    for (const at of sourceTypes) {
      const kind = (at as any).kind ?? "core";

      await ctx.runMutation(internal.mutations.activityTypes.create, {
        challengeId,
        name: at.name,
        description: at.description,
        scoringConfig: at.scoringConfig as any,
        contributesToStreak: at.contributesToStreak,
        isNegative: at.isNegative,
        categoryId: (at as any).categoryId,
        bonusThresholds: (at as any).bonusThresholds,
        displayOrder: (at as any).displayOrder,
        sortOrder: (at as any).sortOrder,
        kind,
        availableInFinalDays: (at as any).availableInFinalDays,
        maxPerChallenge: (at as any).maxPerChallenge,
        validWeeks: (at as any).validWeeks,
        createdAt: now,
        updatedAt: now,
      });

      const weekInfo = (at as any).validWeeks?.length
        ? ` (weeks: ${(at as any).validWeeks.join(",")})`
        : "";
      console.log(`  ✅ ${at.name}${weekInfo}`);
      cloned++;
    }

    console.log(`\nCloned ${cloned} activity types`);

    // ── Create draft mini-games ───────────────────────────────
    // Week 1 (Mar 1-7): nothing
    // Week 2 (Mar 8-14): Partner Week
    // Week 3 (Mar 15-21): Hunt Week
    // Week 4 (Mar 22-28): PR Week
    const startMs = new Date(CHALLENGE_START + "T00:00:00Z").getTime();

    const miniGames = [
      {
        type: "partner_week" as const,
        name: "Partner Week",
        startsAt: startMs + 7 * DAY_MS,  // Mar 8
        endsAt: startMs + 14 * DAY_MS,   // Mar 15 (exclusive)
        config: { bonusPercentage: 10 },
      },
      {
        type: "hunt_week" as const,
        name: "Hunt Week",
        startsAt: startMs + 14 * DAY_MS, // Mar 15
        endsAt: startMs + 21 * DAY_MS,   // Mar 22 (exclusive)
        config: { catchBonus: 75, caughtPenalty: 25 },
      },
      {
        type: "pr_week" as const,
        name: "PR Week",
        startsAt: startMs + 21 * DAY_MS, // Mar 22
        endsAt: startMs + 28 * DAY_MS,   // Mar 29 (exclusive)
        config: { prBonus: 100 },
      },
    ];

    for (const game of miniGames) {
      await ctx.runMutation(internal.mutations.miniGames.createInternal, {
        challengeId,
        type: game.type,
        name: game.name,
        startsAt: game.startsAt,
        endsAt: game.endsAt,
        config: game.config,
      });
      const startDate = new Date(game.startsAt).toISOString().slice(0, 10);
      const endDate = new Date(game.endsAt).toISOString().slice(0, 10);
      console.log(`  ✅ ${game.name} (${startDate} – ${endDate}) [draft]`);
    }

    console.log(`\n🎉 Done! ${cloned} activity types + 3 mini-games created`);
    return { challengeId, cloned, miniGames: 3 };
  },
});
