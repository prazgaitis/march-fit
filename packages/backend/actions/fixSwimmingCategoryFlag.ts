"use node";

/**
 * One-off migration: Ensure Swimming category has showInCategoryLeaderboard = false.
 *
 * Run with:
 *   npx convex run actions/fixSwimmingCategoryFlag:fixSwimmingCategoryFlag --prod
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";

export const fixSwimmingCategoryFlag = action({
  args: {},
  handler: async (ctx) => {
    const swimmingCategory = await ctx.runQuery(
      internal.queries.categories.getByName,
      { name: "Swimming" },
    );

    if (!swimmingCategory) {
      console.log("❌ Swimming category not found");
      return { success: false, reason: "not_found" };
    }

    console.log(
      `Swimming category: ${swimmingCategory._id}, showInCategoryLeaderboard: ${swimmingCategory.showInCategoryLeaderboard}`,
    );

    if (swimmingCategory.showInCategoryLeaderboard === false) {
      console.log("✅ Already set to false, no change needed");
      return { success: true, alreadyCorrect: true };
    }

    await ctx.runMutation(internal.mutations.categories.updateInternal, {
      categoryId: swimmingCategory._id,
      showInCategoryLeaderboard: false,
    });

    console.log("✅ Set showInCategoryLeaderboard to false");
    return { success: true, alreadyCorrect: false };
  },
});
