import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";

type BackfillCandidate = {
  _id: Doc<"activities">["_id"];
  userId: Doc<"activities">["userId"];
  source: Doc<"activities">["source"];
  externalId?: string;
  cloudinaryPublicIds: string[];
};

function toCandidate(a: Doc<"activities">): BackfillCandidate | null {
  if (a.deletedAt) return null;
  if (!a.cloudinaryPublicIds || a.cloudinaryPublicIds.length === 0) return null;
  if (a.optimizedMediaIds && a.optimizedMediaIds.length > 0) return null;
  return {
    _id: a._id,
    userId: a.userId,
    source: a.source,
    externalId: a.externalId,
    cloudinaryPublicIds: a.cloudinaryPublicIds,
  };
}

/**
 * Page through activities that need migration from Cloudinary to Cloudflare.
 * A candidate is any non-deleted activity where `cloudinaryPublicIds` has
 * entries but `optimizedMediaIds` is empty. Paginated (rather than "take the
 * first N") so candidates the backfill cannot recover don't starve later ones.
 * Pages can come back shorter than `numItems` because of the filter.
 */
export const findActivitiesNeedingCloudflareBackfill = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    activityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    if (args.activityId) {
      const a = await ctx.db.get(args.activityId);
      const candidate = a ? toCandidate(a) : null;
      return { page: candidate ? [candidate] : [], continueCursor: "", isDone: true };
    }

    const result = await ctx.db
      .query("activities")
      .filter((q) => q.neq(q.field("cloudinaryPublicIds"), undefined))
      .paginate(args.paginationOpts);

    return {
      page: result.page.map(toCandidate).filter((c): c is BackfillCandidate => c !== null),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
