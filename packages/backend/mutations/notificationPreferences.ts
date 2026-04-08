import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update notification preferences for the current user.
 * Creates the record if it doesn't exist (upsert).
 */
export const update = mutation({
  args: {
    userId: v.id("users"),
    emailLikes: v.optional(v.boolean()),
    emailComments: v.optional(v.boolean()),
    emailFollows: v.optional(v.boolean()),
    emailChallengeJoins: v.optional(v.boolean()),
    emailAchievements: v.optional(v.boolean()),
    emailStravaImports: v.optional(v.boolean()),
    emailMiniGames: v.optional(v.boolean()),
    emailAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const now = Date.now();

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();

    // Filter out undefined values
    const definedUpdates: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        definedUpdates[key] = value;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...definedUpdates,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new record with defaults (all false) + any provided values
    return await ctx.db.insert("notificationPreferences", {
      userId,
      emailLikes: false,
      emailComments: false,
      emailFollows: false,
      emailChallengeJoins: false,
      emailAchievements: false,
      emailStravaImports: false,
      emailMiniGames: false,
      emailAdmin: false,
      ...definedUpdates,
      updatedAt: now,
    });
  },
});
