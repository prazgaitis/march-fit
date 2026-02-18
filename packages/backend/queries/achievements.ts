import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";
import {
  computeCriteriaProgress,
  getCriteriaActivityTypeIds,
} from "../lib/achievements";

/**
 * Internal lookup by ID — used by HTTP API handlers (update/delete).
 */
export const getByIdInternal = internalQuery({
  args: {
    achievementId: v.id("achievements"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.achievementId);
  },
});

/**
 * Get all achievements for a challenge (with resolved activity type names).
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

    const result = await Promise.all(
      achievements.map(async (achievement) => {
        const activityTypes = await Promise.all(
          getCriteriaActivityTypeIds(achievement.criteria).map((id) => ctx.db.get(id))
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
 * Internal helper: build per-achievement progress for a given user.
 */
async function buildUserProgress(
  ctx: any,
  userId: any,
  challengeId: any
) {
  const achievements = await ctx.db
    .query("achievements")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  // All non-deleted activities for this user in the challenge
  const activities = await ctx.db
    .query("activities")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .filter((q: any) =>
      q.and(q.eq(q.field("challengeId"), challengeId), notDeleted(q))
    )
    .collect();

  // Earned achievements
  const userAchievements = await ctx.db
    .query("userAchievements")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("challengeId"), challengeId))
    .collect();

  const earnedMap = new Map<string, any>(
    userAchievements.map((ua: any) => [ua.achievementId as string, ua])
  );

  return achievements.map((achievement: any) => {
    const { currentCount, requiredCount } = computeCriteriaProgress(
      activities,
      achievement.criteria
    );

    const earned = earnedMap.get(achievement._id);
    const criteriaType: string = achievement.criteria.criteriaType ?? "count";

    return {
      achievementId: achievement._id,
      name: achievement.name,
      description: achievement.description,
      bonusPoints: achievement.bonusPoints,
      frequency: achievement.frequency,
      criteriaType,
      // Numeric progress (semantics depend on criteriaType)
      currentCount,
      requiredCount,
      isEarned: !!earned,
      earnedAt: earned?.earnedAt,
    };
  });
}

/**
 * Get the logged-in user's progress on all achievements for a challenge.
 * Uses Clerk/Better Auth identity.
 */
export const getUserProgress = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return buildUserProgress(ctx, user._id, args.challengeId);
  },
});

/**
 * Internal variant — takes userId explicitly (used by HTTP API handlers).
 */
export const getUserProgressInternal = internalQuery({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return buildUserProgress(ctx, args.userId, args.challengeId);
  },
});

/**
 * Get achievements earned by a specific user (for viewing other profiles).
 * Returns only earned achievements — no in-progress data.
 */
export const getEarnedByUser = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userAchievements = await ctx.db
      .query("userAchievements")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("challengeId"), args.challengeId))
      .collect();

    const results = await Promise.all(
      userAchievements.map(async (ua) => {
        const achievement = await ctx.db.get(ua.achievementId);
        if (!achievement) return null;
        return {
          achievementId: achievement._id,
          name: achievement.name,
          description: achievement.description,
          bonusPoints: achievement.bonusPoints,
          earnedAt: ua.earnedAt,
        };
      })
    );

    return results.filter(Boolean);
  },
});
