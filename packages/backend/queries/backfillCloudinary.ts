import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Find activities that have Convex mediaIds but no cloudinaryPublicIds.
 * Used by the backfill action to process existing media.
 */
export const findActivitiesNeedingBackfill = internalQuery({
  args: {
    daysBack: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 7;
    const limit = args.limit ?? 50;
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const activities = await ctx.db
      .query("activities")
      .order("desc")
      .filter((q) =>
        q.and(
          q.gt(q.field("createdAt"), cutoff),
          q.neq(q.field("mediaIds"), undefined),
        ),
      )
      .take(limit * 5); // over-fetch then filter

    return activities
      .filter(
        (a) =>
          a.mediaIds &&
          a.mediaIds.length > 0 &&
          (!a.cloudinaryPublicIds || a.cloudinaryPublicIds.length === 0),
      )
      .slice(0, limit)
      .map((a) => ({
        _id: a._id,
        mediaIds: a.mediaIds!,
      }));
  },
});
