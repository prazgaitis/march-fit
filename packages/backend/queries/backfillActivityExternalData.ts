import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Paginated fetch of activities that still have externalData on the document.
 * Used by the backfill action to migrate data to the companion table.
 */
export const listActivitiesWithExternalData = internalQuery({
  args: {
    challengeId: v.id("challenges"),
    cursor: v.optional(v.string()),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter((q) => q.neq(q.field("externalData"), undefined))
      .paginate({ numItems: args.pageSize, cursor: args.cursor ?? null });
    return {
      page: result.page.map((a) => ({
        _id: a._id,
        externalData: a.externalData,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
