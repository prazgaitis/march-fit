"use node";

/**
 * Migration: Configure Final Days settings for both 2026 challenges.
 *
 * Sets:
 *  - challenge.finalDaysStart = 29 (days 29-end re-show availableInFinalDays activities)
 *  - availableInFinalDays = true on the weekly-special activity types
 *
 * Safe to re-run (idempotent).
 *
 * Run with:
 *   npx convex run actions/setMarch2026FinalDays:setMarch2026FinalDays
 */

import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const CHALLENGE_NAMES = ["February Warmup 2026", "March Fitness 2026"];

const FINAL_DAYS_START = 29;

const AVAILABLE_IN_FINAL_DAYS: Set<string> = new Set([
  "Burpee Challenge Week 1",
  "Burpee Challenge Week 2",
  "Burpee Challenge Week 3",
  "Burpee Challenge Week 4",
  "Sally-up Challenge",
  "Tracy Anderson Arms",
  "Retro Abs Bonus",
  "Hotel Room Workout",
  "The Max",
  "The Murph",
  "Thigh Burner",
  "Active Recovery + Breath Work",
  "Card Workout (Partner or Solo)",
]);

// Activity types that need maxPerChallenge bumped by 1 for the final days
// (so users who already hit the limit can do it one more time)
const BUMP_MAX_PER_CHALLENGE: Record<string, number> = {
  "Sally-up Challenge": 2, // was 1
  "Active Recovery + Breath Work": 2, // was 1
};

export const setMarch2026FinalDays = internalAction({
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

    const results: Record<string, any> = {};

    for (const challenge of challenges) {
      const challengeId = challenge.id as Id<"challenges">;
      console.log(`\n📋 ${challenge.name}`);

      // 1. Set finalDaysStart on the challenge
      await ctx.runMutation(internal.mutations.challenges.setFinalDaysStart, {
        challengeId,
        finalDaysStart: FINAL_DAYS_START,
      });
      console.log(`  ✅ finalDaysStart = ${FINAL_DAYS_START}`);

      // 2. Set availableInFinalDays on matching activity types
      const activityTypes = await ctx.runQuery(
        api.queries.activityTypes.getByChallengeId,
        { challengeId }
      );

      let updated = 0;
      let skipped = 0;
      const missing: string[] = [];

      for (const at of activityTypes) {
        if (!AVAILABLE_IN_FINAL_DAYS.has(at.name)) continue;

        if (at.availableInFinalDays === true) {
          skipped++;
          continue;
        }

        const updateArgs: Record<string, any> = {
          activityTypeId: at._id,
          availableInFinalDays: true,
        };
        if (BUMP_MAX_PER_CHALLENGE[at.name] !== undefined) {
          updateArgs.maxPerChallenge = BUMP_MAX_PER_CHALLENGE[at.name];
        }
        await ctx.runMutation(internal.mutations.activityTypes.updateInternal, updateArgs);
        const extra = updateArgs.maxPerChallenge ? `, maxPerChallenge: ${updateArgs.maxPerChallenge}` : "";
        console.log(`  🔄 "${at.name}" → availableInFinalDays: true${extra}`);
        updated++;
      }

      // Report any expected activities that weren't found
      const foundNames = new Set(activityTypes.map((at: any) => at.name));
      for (const name of AVAILABLE_IN_FINAL_DAYS) {
        if (!foundNames.has(name)) missing.push(name);
      }
      if (missing.length > 0) {
        console.log(`  ⚠️  Not found in this challenge: ${missing.join(", ")}`);
      }

      results[challenge.name] = { updated, skipped, missing };
    }

    console.log("\n🎉 Done!");
    return { success: true, finalDaysStart: FINAL_DAYS_START, results };
  },
});
