import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { calculateFinalActivityScore } from "../lib/scoring";
import { notDeleted } from "../lib/activityFilters";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";
import { applyParticipationScoreDeltaAndRecomputeStreak } from "../lib/participationScoring";

/**
 * Re-score Strava activities with 0 points that have valid metrics.
 * Fixes activities scored before metric alias resolution was added.
 */
export const rescoreZeroPointActivities = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    try {
      const challenge = await ctx.db.get(args.challengeId);
      if (!challenge) throw new Error("Challenge not found");

    // Get all Strava activities with 0 points
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter((q) =>
        q.and(
          q.eq(q.field("source"), "strava"),
          q.eq(q.field("pointsEarned"), 0),
          notDeleted(q)
        )
      )
      .collect();

    const results: Array<{
      activityId: string;
      userId: string;
      activityType: string;
      metrics: Record<string, unknown>;
      oldPoints: number;
      newPoints: number;
    }> = [];

    // Track per-user point adjustments
    const userPointAdjustments = new Map<string, number>();

    for (const activity of activities) {
      const activityType = await ctx.db.get(activity.activityTypeId);
      if (!activityType) continue;

      const metrics = (activity.metrics ?? {}) as Record<string, unknown>;
      const loggedDate = new Date(activity.loggedDate);

      const hasMedia = !!(activity.mediaIds?.length || activity.imageUrl);
      const score = await calculateFinalActivityScore(
        activityType,
        {
          ctx,
          metrics,
          userId: activity.userId,
          challengeId: args.challengeId,
          loggedDate,
        },
        {
          includeMediaBonus: hasMedia,
        }
      );
      const newPoints = score.pointsEarned;

      if (newPoints !== 0) {
        results.push({
          activityId: activity._id,
          userId: activity.userId,
          activityType: activityType.name,
          metrics,
          oldPoints: 0,
          newPoints,
        });

        if (!args.dryRun) {
          await ctx.db.patch(activity._id, {
            pointsEarned: newPoints,
            triggeredBonuses:
              score.triggeredBonuses.length > 0
                ? score.triggeredBonuses
                : undefined,
            updatedAt: Date.now(),
          });

          const prev = userPointAdjustments.get(activity.userId) ?? 0;
          userPointAdjustments.set(activity.userId, prev + newPoints);
        }
      }
    }

    // Update participation totals + streaks
    if (!args.dryRun) {
      for (const [userId, pointsToAdd] of userPointAdjustments) {
        await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
          userId: userId as any,
          challengeId: args.challengeId,
          pointsDelta: pointsToAdd,
          streakMinPoints: challenge.streakMinPoints,
        });
      }
    }

      return {
        totalScanned: activities.length,
        totalFixed: results.length,
        dryRun: args.dryRun,
        fixes: results,
      };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.rescoreStrava.rescoreZeroPointActivities",
        startedAt,
        challengeId: String(args.challengeId),
      });
    }
  },
});
