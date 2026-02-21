"use node";

/**
 * Migration: Set displayOrder on all activity types in both 2026 challenges.
 *
 * Safe to re-run — uses exact name matching and only patches what changed.
 *
 * Run with:
 *   npx convex run actions/setMarch2026ActivityOrder:setMarch2026ActivityOrder
 */

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const CHALLENGE_NAMES = ["February Warmup 2026", "March Fitness 2026"];

/**
 * displayOrder values — lower number = higher in the logging menu.
 * Activities not listed here are left unchanged (they'll sort after all listed ones).
 */
const DISPLAY_ORDER: Record<string, number> = {
  // ── Core cardio ─────────────────────────────────────────────
  "Outdoor Run":              10,
  "Walking for Fitness":      15, // in case it exists
  "Rowing":                   20,
  "Swimming":                 30,
  "Hi-Intensity Cardio":      40,
  "Lo-Intensity Cardio":      50,
  "Outdoor Cycling":          60,
  "Yoga / Stretching":        70,
  "Horses":                   80,
  "Skiing Half Day":          90,
  "Skiing Full Day":          100,
  "Hotel Room Workout":       110,
  // ── Weekly specials ─────────────────────────────────────────
  "Burpee Challenge Week 1":  200,
  "Burpee Challenge Week 2":  210,
  "Burpee Challenge Week 3":  220,
  "Burpee Challenge Week 4":  230,
  "The Max":                  240,
  "Sally-up Challenge":       250,
  "Tracy Anderson Arms":      260,
  "The Murph":                270,
  "10 Days of Mindfulness":   280,
  // ── Self-awarded bonuses ─────────────────────────────────────
  "Workout with a Friend":    300,
  "Retro Abs Bonus":          310,
  // ── Admin-awarded bonuses ────────────────────────────────────
  "Partner Week Bonus":       400,
  "PR Week Bonus":            410,
  "The Hunt Bonus":           420,
  "Category Leader Bonus":    430,
  // ── Penalties ────────────────────────────────────────────────
  "Drinks":                   500,
  "Overindulge":              510,
};

export const setMarch2026ActivityOrder = action({
  args: {},
  handler: async (ctx) => {
    const allChallenges = await ctx.runQuery(api.queries.challenges.listPublic, {
      limit: 100,
    });

    const challenges = CHALLENGE_NAMES.map((name) => {
      const found = allChallenges.find((c: any) => c.name === name);
      if (!found) throw new Error(`Challenge "${name}" not found`);
      return found;
    });
    console.log(`✅ Challenges: ${challenges.map((c: any) => c.name).join(", ")}`);

    const results: Record<string, { updated: number; skipped: number; unknown: string[] }> = {};

    for (const challenge of challenges) {
      const challengeId = challenge.id as Id<"challenges">;
      console.log(`\n📋 ${challenge.name}`);

      const activityTypes = await ctx.runQuery(
        api.queries.activityTypes.getByChallengeId,
        { challengeId }
      );

      let updated = 0;
      let skipped = 0;
      const unknown: string[] = [];

      for (const at of activityTypes) {
        const order = DISPLAY_ORDER[at.name];
        if (order === undefined) {
          unknown.push(at.name);
          continue;
        }
        if (at.displayOrder === order) {
          skipped++;
          continue;
        }
        await ctx.runMutation(internal.mutations.activityTypes.updateInternal, {
          activityTypeId: at._id,
          displayOrder: order,
        });
        console.log(`  ✅ "${at.name}" → displayOrder ${order}`);
        updated++;
      }

      if (unknown.length > 0) {
        console.log(`  ⚠️  No displayOrder defined for: ${unknown.join(", ")}`);
      }

      results[challenge.name] = { updated, skipped, unknown };
    }

    console.log("\n🎉 Done!");
    return { success: true, results };
  },
});
