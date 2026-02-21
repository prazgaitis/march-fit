"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Clear all data from the database
 * This can be called from the Convex dashboard or CLI
 */
export const clear = action({
  args: {},
  handler: async (ctx) => {
    console.log("🗑️ Clearing Convex database...");

    // Order matters due to foreign key-like relationships
    // Delete in reverse order of dependencies
    const tables = [
      "activityFlagHistory",
      "likes",
      "comments",
      "notifications",
      "activities",
      "activityTypes",
      "userChallenges",
      "challenges",
      "templateActivityTypes",
      "categories",
      "integrationMappings",
      "users",
    ] as const;

    for (const table of tables) {
      console.log(`  Clearing ${table}...`);
      let hasMore = true;
      while (hasMore) {
        const result = await ctx.runMutation(internal.mutations.clear.clearTable, { table });
        hasMore = result.hasMore;
        if (hasMore) {
          console.log(`    ...deleted ${result.deleted}, continuing...`);
        }
      }
    }

    console.log("✅ Database cleared!");
    return { success: true };
  },
});
