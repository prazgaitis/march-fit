"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * One-off fix for contributesToStreak values
 * Sets correct values for:
 * - Skiing Half Day: true
 * - Skiing Full Day: true
 * - Sally-up challenge: true
 * - Tracy Anderson Arms: true
 * - Drinks: false
 */
export const fix = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("🔧 Fixing contributesToStreak values...");

    const fixes = [
      { name: "Skiing Half Day", contributesToStreak: true },
      { name: "Skiing Full Day", contributesToStreak: true },
      { name: "Sally-up challenge", contributesToStreak: true },
      { name: "Tracy Anderson Arms", contributesToStreak: true },
      { name: "Drinks", contributesToStreak: false },
    ];

    const result = await ctx.runMutation(internal.mutations.fixStreak.fixContributesToStreak, {
      fixes,
    });

    console.log("✅ Fix complete:", result);
    return result;
  },
});
