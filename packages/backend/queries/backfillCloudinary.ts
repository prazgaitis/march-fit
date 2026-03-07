import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getActivitiesNeedingBackfill = internalQuery({
  args: {
    cutoffMs: v.number(),
  },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activities")
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.gte(q.field("createdAt"), args.cutoffMs),
        ),
      )
      .collect();

    // Filter to those with mediaIds but no cloudinaryPublicIds
    const needsBackfill = activities.filter(
      (a) =>
        a.mediaIds &&
        a.mediaIds.length > 0 &&
        (!a.cloudinaryPublicIds || a.cloudinaryPublicIds.length === 0),
    );

    // Return activity IDs and their storage URLs
    const result = await Promise.all(
      needsBackfill.map(async (a) => {
        const urls = await Promise.all(
          a.mediaIds!.map(async (storageId) => {
            const url = await ctx.storage.getUrl(storageId);
            return { storageId: storageId as string, url };
          }),
        );
        return {
          activityId: a._id as string,
          media: urls.filter(
            (u): u is { storageId: string; url: string } => u.url !== null,
          ),
        };
      }),
    );

    return result.filter((r) => r.media.length > 0);
  },
});
