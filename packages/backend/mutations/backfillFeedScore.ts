import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { computeFeedScore, computeFeedRank, type ContentScoreInput, type EngagementScoreInput } from "../lib/feedScoring";

/**
 * Backfill feedScore on activities that don't have one yet.
 *
 * Scans a batch of activities using a filter on feedScore === undefined,
 * computes the score, and patches them. Call repeatedly until
 * `processed === 0` (all done).
 *
 * To re-rank existing rows after ranking formula changes, use
 * `forceRecompute: true` with cursor pagination. This recomputes
 * feedScore/feedRank for all scanned activities (or a scoped challenge).
 *
 * Designed for 25k+ activities: uses `.take(batchSize)` + filter to
 * avoid loading the entire table into memory.
 *
 * Run via:
 *   npx convex run mutations/backfillFeedScore:backfillFeedScore '{"batchSize": 100, "dryRun": true}'
 *   npx convex run mutations/backfillFeedScore:backfillFeedScore '{"batchSize": 100, "dryRun": false}'
 *
 * Or scoped to a single challenge:
 *   npx convex run mutations/backfillFeedScore:backfillFeedScore '{"batchSize": 100, "dryRun": false, "challengeId": "<id>"}'
 */
export const backfillFeedScore = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    forceRecompute: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    challengeId: v.optional(v.id("challenges")),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const dryRun = args.dryRun ?? false;
    const forceRecompute = args.forceRecompute ?? false;
    const cursor = args.cursor ?? null;

    const baseQuery = args.challengeId
      ? ctx.db
          .query("activities")
          .withIndex("challengeId", (q) =>
            q.eq("challengeId", args.challengeId!),
          )
      : ctx.db.query("activities");
    const pageResult = forceRecompute
      ? await baseQuery.order("asc").paginate({
          cursor,
          numItems: batchSize,
        })
      : null;
    // Default mode: scan only rows that never got feedRank.
    // Recompute mode: paginate all rows with cursor progression.
    const batch = forceRecompute
      ? pageResult!.page
      : await baseQuery
          .filter((q) => q.eq(q.field("feedRank"), undefined))
          .take(batchSize);

    let scanned = 0;
    let updated = 0;
    for (const activity of batch) {
      scanned++;
      // Count likes and comments for this activity.
      const [likeCount, commentCount] = await Promise.all([
        ctx.db
          .query("likes")
          .withIndex("activityId", (q) => q.eq("activityId", activity._id))
          .collect()
          .then((rows) => rows.length),
        ctx.db
          .query("comments")
          .withIndex("activityId", (q) => q.eq("activityId", activity._id))
          .collect()
          .then((rows) => rows.length),
      ]);

      const content: ContentScoreInput = {
        hasDescription: !!activity.notes && activity.notes.trim().length > 0,
        mediaCount: (activity.mediaIds?.length ?? 0) + (activity.cloudinaryPublicIds?.length ?? 0),
        pointsEarned: activity.pointsEarned,
        triggeredBonusCount: activity.triggeredBonuses?.length ?? 0,
        flagged: activity.flagged,
      };
      const engagement: EngagementScoreInput = { likeCount, commentCount };
      const score = computeFeedScore(content, engagement);

      const rank = computeFeedRank(score, activity.createdAt);

      const shouldPatch = activity.feedScore !== score || activity.feedRank !== rank;
      if (!dryRun && shouldPatch) {
        await ctx.db.patch(activity._id, { feedScore: score, feedRank: rank });
      }
      if (shouldPatch) {
        updated++;
      }
    }

    return {
      dryRun,
      forceRecompute,
      scanned,
      processed: scanned,
      updated,
      continueCursor: pageResult?.continueCursor ?? null,
      done: forceRecompute ? pageResult?.isDone ?? true : batch.length < batchSize,
    };
  },
});
