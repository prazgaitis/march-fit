import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { calculateActivityPoints, calculateThresholdBonuses, calculateMediaBonus } from "../lib/scoring";
import { notDeleted } from "../lib/activityFilters";

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

      const basePoints = await calculateActivityPoints(activityType, {
        ctx,
        metrics,
        userId: activity.userId,
        challengeId: args.challengeId,
        loggedDate,
      });

      const { totalBonusPoints: thresholdBonusPoints, triggeredBonuses } =
        calculateThresholdBonuses(activityType, metrics);

      const hasMedia = !!(activity.mediaIds?.length || activity.imageUrl);
      const { totalBonusPoints: mediaBonusPoints, triggeredBonus: mediaTriggered } =
        calculateMediaBonus(hasMedia);

      const rawPoints = basePoints + thresholdBonusPoints + mediaBonusPoints;
      const newPoints = activityType.isNegative ? -rawPoints : rawPoints;

      if (newPoints > 0) {
        const allBonuses = [
          ...triggeredBonuses,
          ...(mediaTriggered ? [mediaTriggered] : []),
        ];

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
            triggeredBonuses: allBonuses.length > 0 ? allBonuses : undefined,
            updatedAt: Date.now(),
          });

          const prev = userPointAdjustments.get(activity.userId) ?? 0;
          userPointAdjustments.set(activity.userId, prev + newPoints);
        }
      }
    }

    // Update participation totals
    if (!args.dryRun) {
      for (const [userId, pointsToAdd] of userPointAdjustments) {
        const participation = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId as any).eq("challengeId", args.challengeId)
          )
          .first();

        if (participation) {
          await ctx.db.patch(participation._id, {
            totalPoints: participation.totalPoints + pointsToAdd,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return {
      totalScanned: activities.length,
      totalFixed: results.length,
      dryRun: args.dryRun,
      fixes: results,
    };
  },
});
