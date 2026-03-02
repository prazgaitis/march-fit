import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { computeFeedScore, type ContentScoreInput, type EngagementScoreInput } from "../lib/feedScoring";

/**
 * Backfill feedScore on activities that don't have one yet.
 *
 * Scans a batch of activities using a filter on feedScore === undefined,
 * computes the score, and patches them. Call repeatedly until
 * `processed === 0` (all done).
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
    challengeId: v.optional(v.id("challenges")),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const dryRun = args.dryRun ?? false;

    // Scan for activities that still need a feedScore.
    // Using .filter() + .take() ensures we don't load the whole table.
    let baseQuery = ctx.db.query("activities");
    if (args.challengeId) {
      baseQuery = baseQuery.withIndex("challengeId", (q) =>
        q.eq("challengeId", args.challengeId!),
      );
    }
    const batch = await baseQuery
      .filter((q) => q.eq(q.field("feedScore"), undefined))
      .take(batchSize);

    let updated = 0;
    for (const activity of batch) {
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
        notesLength: activity.notes?.length ?? 0,
        mediaCount: activity.mediaIds?.length ?? 0,
        pointsEarned: activity.pointsEarned,
        triggeredBonusCount: activity.triggeredBonuses?.length ?? 0,
        flagged: activity.flagged,
      };
      const engagement: EngagementScoreInput = { likeCount, commentCount };
      const score = computeFeedScore(content, engagement);

      if (!dryRun) {
        await ctx.db.patch(activity._id, { feedScore: score });
      }
      updated++;
    }

    return {
      dryRun,
      processed: updated,
      done: batch.length < batchSize,
    };
  },
});
