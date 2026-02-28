import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Paginated fetch of non-deleted activities for a challenge.
 * Returns loggedDate (needed for week number calculation).
 */
export const listActivitiesPage = internalQuery({
  args: {
    challengeId: v.id("challenges"),
    cursor: v.optional(v.string()),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .paginate({ numItems: args.pageSize, cursor: args.cursor ?? null });
    return {
      page: result.page.map((a) => ({
        userId: a.userId,
        activityTypeId: a.activityTypeId,
        pointsEarned: a.pointsEarned,
        loggedDate: a.loggedDate,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Fetch all existing weeklyCategoryPoints rows for a challenge.
 */
export const listForChallenge = internalQuery({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weeklyCategoryPoints")
      .withIndex("weekCategory", (q) =>
        q.eq("challengeId", args.challengeId)
      )
      .collect();
  },
});
