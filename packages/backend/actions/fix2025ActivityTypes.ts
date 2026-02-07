"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Activity types that should NOT contribute to streak
// These are bonuses awarded on top of workouts, not workouts themselves
const SHOULD_NOT_CONTRIBUTE_TO_STREAK = [
  // Bonus types (awarded by admins/system, not actual workouts)
  "PR Week Bonus",
  "Partner Week Bonus",
  "The Partner Bonus",
  "Category Leader Bonus",
  "The Hunt Bonus",
  "March Fitness Triathlon", // Combo bonus, not a workout

  // Distance milestone bonuses (awarded on top of regular activity points)
  "26.2 mile run",
  "Half Marathon ",  // Note: has trailing space in the data
  "112 mile bike ride",
  "42.2k erg",
  "2.4 mile swim",

  // Skiing (description says "does not extend streak")
  "Skiing Full Day",
  "Skiing Half Day",
];

export const fix2025ActivityTypes = action({
  args: {},
  handler: async (ctx) => {
    console.log("🔧 Fixing contributesToStreak for March Fitness 2025...");

    const challengeId = "js70x6chtefs0femxjkdtmkx0x7wb26e" as Id<"challenges">;

    // Get all activity types for the challenge
    const challenge = await ctx.runQuery(internal.queries.challenges.getByIdInternal, {
      challengeId,
    });

    if (!challenge) {
      throw new Error("March Fitness 2025 not found");
    }

    const fixed: string[] = [];
    const skipped: string[] = [];

    for (const activityType of challenge.activityTypes) {
      if (SHOULD_NOT_CONTRIBUTE_TO_STREAK.includes(activityType.name)) {
        if (activityType.contributesToStreak === true) {
          // Need to fix this one
          await ctx.runMutation(internal.mutations.activityTypes.updateInternal, {
            activityTypeId: activityType._id,
            contributesToStreak: false,
          });
          fixed.push(activityType.name);
          console.log(`✅ Fixed: ${activityType.name} -> contributesToStreak: false`);
        } else {
          skipped.push(activityType.name);
          console.log(`⏭️ Already correct: ${activityType.name}`);
        }
      }
    }

    console.log(`\n🎉 Fixed ${fixed.length} activity types`);

    return {
      success: true,
      fixed,
      skipped,
    };
  },
});
