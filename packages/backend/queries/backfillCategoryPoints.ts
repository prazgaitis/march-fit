import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Paginated fetch of non-deleted activities for a challenge.
 * Used by the backfill action.
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
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Fetch all existing categoryPoints rows for a challenge.
 * Used by the backfill action to clear before re-aggregating.
 */
export const listForChallenge = internalQuery({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categoryPoints")
      .withIndex("challengeCategory", (q) =>
        q.eq("challengeId", args.challengeId)
      )
      .collect();
  },
});
