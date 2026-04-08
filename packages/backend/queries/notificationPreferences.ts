import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get notification preferences for a user.
 * Returns null if no preferences have been set (all defaults to off).
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notificationPreferences")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});
