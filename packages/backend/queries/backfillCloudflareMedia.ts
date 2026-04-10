import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Find activities that need migration from Cloudinary to Cloudflare.
 * A candidate is any non-deleted activity where `cloudinaryPublicIds` has
 * entries but `optimizedMediaIds` is empty — those still serve from
 * `res.cloudinary.com` at render time.
 */
export const findActivitiesNeedingCloudflareBackfill = internalQuery({
  args: {
    limit: v.optional(v.number()),
    activityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    if (args.activityId) {
      const a = await ctx.db.get(args.activityId);
      if (!a || a.deletedAt) return [];
      if (!a.cloudinaryPublicIds || a.cloudinaryPublicIds.length === 0) return [];
      if (a.optimizedMediaIds && a.optimizedMediaIds.length > 0) return [];
      return [{ _id: a._id, cloudinaryPublicIds: a.cloudinaryPublicIds }];
    }

    const limit = args.limit ?? 50;
    // Over-fetch then filter — the schema has no index for this combo.
    const activities = await ctx.db
      .query("activities")
      .order("desc")
      .filter((q) => q.neq(q.field("cloudinaryPublicIds"), undefined))
      .take(limit * 5);

    return activities
      .filter(
        (a) =>
          !a.deletedAt &&
          a.cloudinaryPublicIds &&
          a.cloudinaryPublicIds.length > 0 &&
          (!a.optimizedMediaIds || a.optimizedMediaIds.length === 0),
      )
      .slice(0, limit)
      .map((a) => ({ _id: a._id, cloudinaryPublicIds: a.cloudinaryPublicIds! }));
  },
});

/**
 * Sample up to `sampleCap` recent activities and report how many of them
 * still need Cloudflare migration. This is an estimator, not an exact count
 * — the activities table has no index on `cloudinaryPublicIds`, so full
 * scans time out on prod-sized datasets. For definitive progress, run
 * `backfill` with a generous `limit` and watch `totalCandidates` shrink.
 */
export const countRemainingCloudflareBackfill = query({
  args: { sampleCap: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sampleCap = args.sampleCap ?? 500;
    const sample = await ctx.db.query("activities").order("desc").take(sampleCap);

    const withLegacy = sample.filter(
      (a) =>
        !a.deletedAt &&
        a.cloudinaryPublicIds &&
        a.cloudinaryPublicIds.length > 0,
    );
    const remaining = withLegacy.filter(
      (a) => !a.optimizedMediaIds || a.optimizedMediaIds.length === 0,
    );

    return {
      sampled: sample.length,
      withLegacyCloudinary: withLegacy.length,
      stillUnmigrated: remaining.length,
      sampleCap,
    };
  },
});
