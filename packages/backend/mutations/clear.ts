import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Clear all documents from a specific table
 */
export const clearTable = internalMutation({
  args: {
    table: v.union(
      v.literal("activityFlagHistory"),
      v.literal("likes"),
      v.literal("comments"),
      v.literal("notifications"),
      v.literal("activities"),
      v.literal("activityTypes"),
      v.literal("userChallenges"),
      v.literal("challenges"),
      v.literal("templateActivityTypes"),
      v.literal("categories"),
      v.literal("integrationMappings"),
      v.literal("users")
    ),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db.query(args.table).take(1000);

    for (const doc of documents) {
      await ctx.db.delete(doc._id);
    }

    return { deleted: documents.length, hasMore: documents.length === 1000 };
  },
});
