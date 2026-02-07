import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Get all achievements for a challenge
 */
export const getByChallengeId = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Get activity type names for each achievement
    const result = await Promise.all(
      achievements.map(async (achievement) => {
        const activityTypes = await Promise.all(
          achievement.criteria.activityTypeIds.map((id) => ctx.db.get(id))
        );

        return {
          ...achievement,
          activityTypeNames: activityTypes
            .filter((at) => at !== null)
            .map((at) => at!.name),
        };
      })
    );

    return result;
  },
});

/**
 * Get user's progress on achievements for a challenge
 */
export const getUserProgress = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    // Get all achievements for this challenge
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Get user's activities
    const activities = await ctx.db
      .query("activities")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("challengeId"), args.challengeId))
      .collect();

    // Get user's earned achievements
    const userAchievements = await ctx.db
      .query("userAchievements")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("challengeId"), args.challengeId))
      .collect();

    const earnedIds = new Set(userAchievements.map((ua) => ua.achievementId));

    // Calculate progress for each achievement
    return achievements.map((achievement) => {
      const qualifyingActivities = activities.filter((activity) => {
        if (!achievement.criteria.activityTypeIds.includes(activity.activityTypeId)) {
          return false;
        }

        const metrics = (activity.metrics ?? {}) as Record<string, unknown>;
        const metricValue = Number(metrics[achievement.criteria.metric]) || 0;

        return metricValue >= achievement.criteria.threshold;
      });

      return {
        achievementId: achievement._id,
        name: achievement.name,
        description: achievement.description,
        bonusPoints: achievement.bonusPoints,
        requiredCount: achievement.criteria.requiredCount,
        currentCount: qualifyingActivities.length,
        isEarned: earnedIds.has(achievement._id),
        earnedAt: userAchievements.find((ua) => ua.achievementId === achievement._id)?.earnedAt,
      };
    });
  },
});
