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

import { action } from "../_generated/server";
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
]);

export const setMarch2026FinalDays = action({
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
      await ctx.runMutation(api.mutations.challenges.updateChallenge, {
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

        await ctx.runMutation(internal.mutations.activityTypes.updateInternal, {
          activityTypeId: at._id,
          availableInFinalDays: true,
        });
        console.log(`  🔄 "${at.name}" → availableInFinalDays: true`);
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
