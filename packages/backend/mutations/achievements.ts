import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { computeCriteriaProgress } from "../lib/achievements";
import { notDeleted } from "../lib/activityFilters";
import { insertActivity } from "../lib/activityWrites";

// Shared criteria validator — mirrors the schema union
export const criteriaValidator = v.union(
  // Count-based (existing behavior). criteriaType is optional for backward compat.
  v.object({
    criteriaType: v.optional(v.literal("count")),
    activityTypeIds: v.array(v.id("activityTypes")),
    metric: v.string(),
    threshold: v.number(),
    requiredCount: v.number(),
  }),
  // Cumulative: sum of metric across matching types >= threshold
  v.object({
    criteriaType: v.literal("cumulative"),
    activityTypeIds: v.array(v.id("activityTypes")),
    metric: v.string(),
    threshold: v.number(),
    unitConversions: v.optional(v.record(v.string(), v.number())),
  }),
  // Distinct types: at least 1 activity from N different types in the list
  v.object({
    criteriaType: v.literal("distinct_types"),
    activityTypeIds: v.array(v.id("activityTypes")),
    requiredCount: v.number(),
  }),
  // One of each: at least 1 activity from every type in the list
  v.object({
    criteriaType: v.literal("one_of_each"),
    activityTypeIds: v.array(v.id("activityTypes")),
  }),
  // All activity-type thresholds: each requirement must be met by its specific type
  v.object({
    criteriaType: v.literal("all_activity_type_thresholds"),
    requirements: v.array(
      v.object({
        activityTypeId: v.id("activityTypes"),
        metric: v.string(),
        threshold: v.number(),
      }),
    ),
  }),
  // N-of thresholds: at least requiredCount of per-type thresholds must be met
  v.object({
    criteriaType: v.literal("n_of_thresholds"),
    requiredCount: v.number(),
    requirements: v.array(
      v.object({
        activityTypeId: v.id("activityTypes"),
        metric: v.string(),
        threshold: v.number(),
      }),
    ),
  }),
);

/**
 * Create a new achievement
 */
export const createAchievement = mutation({
  args: {
    challengeId: v.id("challenges"),
    name: v.string(),
    description: v.string(),
    bonusPoints: v.number(),
    criteria: criteriaValidator,
    frequency: v.union(
      v.literal("once_per_challenge"),
      v.literal("once_per_week"),
      v.literal("unlimited")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const achievementId = await ctx.db.insert("achievements", {
      challengeId: args.challengeId,
      name: args.name,
      description: args.description,
      bonusPoints: args.bonusPoints,
      criteria: args.criteria,
      frequency: args.frequency,
      createdAt: now,
      updatedAt: now,
    });

    return achievementId;
  },
});

/**
 * Update an achievement
 */
export const updateAchievement = mutation({
  args: {
    achievementId: v.id("achievements"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    bonusPoints: v.optional(v.number()),
    criteria: v.optional(criteriaValidator),
    frequency: v.optional(
      v.union(
        v.literal("once_per_challenge"),
        v.literal("once_per_week"),
        v.literal("unlimited")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { achievementId, ...updates } = args;

    const achievement = await ctx.db.get(achievementId);
    if (!achievement) {
      throw new Error("Achievement not found");
    }

    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.bonusPoints !== undefined) updateData.bonusPoints = updates.bonusPoints;
    if (updates.criteria !== undefined) updateData.criteria = updates.criteria;
    if (updates.frequency !== undefined) updateData.frequency = updates.frequency;

    await ctx.db.patch(achievementId, updateData);

    return { success: true };
  },
});

/**
 * Delete an achievement
 */
export const deleteAchievement = mutation({
  args: {
    achievementId: v.id("achievements"),
  },
  handler: async (ctx, args) => {
    const achievement = await ctx.db.get(args.achievementId);
    if (!achievement) {
      throw new Error("Achievement not found");
    }

    // Delete associated user achievements
    const userAchievements = await ctx.db
      .query("userAchievements")
      .withIndex("achievementId", (q) => q.eq("achievementId", args.achievementId))
      .collect();

    for (const ua of userAchievements) {
      await ctx.db.delete(ua._id);
    }

    await ctx.db.delete(args.achievementId);

    return { success: true };
  },
});

/**
 * Backfill achievements for a single user (or all participants) in a challenge.
 * Pass userId to process one user (stays within Convex read limits).
 * Omit userId to process all participants (may hit limits on large challenges).
 *
 * Run manually:
 *   ./scripts/convex.sh run mutations/achievements:backfillAchievements \
 *     '{"challengeId": "<id>", "userId": "<id>"}' --prod
 */
export const backfillAchievements = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { challengeId, userId: singleUserId }) => {
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
      .collect();

    if (achievements.length === 0) {
      console.log("No achievements found for challenge");
      return { awarded: 0 };
    }

    const participations = singleUserId
      ? await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", singleUserId).eq("challengeId", challengeId)
          )
          .collect()
      : await ctx.db
          .query("userChallenges")
          .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
          .collect();

    console.log(
      `Checking ${participations.length} participants against ${achievements.length} achievements`
    );

    let bonusActivityType: any = null;
    let totalAwarded = 0;

    for (const participation of participations) {
      const userId = participation.userId;

      const allActivities = await ctx.db
        .query("activities")
        .withIndex("userId", (q: any) => q.eq("userId", userId))
        .filter((q: any) =>
          q.and(q.eq(q.field("challengeId"), challengeId), notDeleted(q))
        )
        .collect();

      for (const achievement of achievements) {
        if (achievement.frequency === "once_per_challenge") {
          const existing = await ctx.db
            .query("userAchievements")
            .withIndex("userAchievement", (q) =>
              q.eq("userId", userId).eq("achievementId", achievement._id)
            )
            .first();
          if (existing) continue;
        }

        const { currentCount, requiredCount, qualifyingActivityIds } =
          computeCriteriaProgress(allActivities, achievement.criteria);

        if (currentCount < requiredCount) continue;

        // Get or create the bonus activity type
        if (!bonusActivityType) {
          bonusActivityType = await ctx.db
            .query("activityTypes")
            .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
            .filter((q) => q.eq(q.field("name"), "Achievement Bonus"))
            .first();

          if (!bonusActivityType) {
            const id = await ctx.db.insert("activityTypes", {
              challengeId,
              name: "Achievement Bonus",
              description: "Bonus points from earning achievements",
              scoringConfig: { basePoints: 0 },
              contributesToStreak: false,
              isNegative: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            bonusActivityType = await ctx.db.get(id);
          }
        }

        const bonusActivityId = await insertActivity(ctx, {
          userId,
          challengeId,
          activityTypeId: bonusActivityType._id,
          loggedDate: Date.now(),
          metrics: {
            achievementId: achievement._id,
            achievementName: achievement.name,
          },
          notes: `Achievement earned: ${achievement.name}`,
          source: "manual",
          pointsEarned: achievement.bonusPoints,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("userAchievements", {
          challengeId,
          userId,
          achievementId: achievement._id,
          earnedAt: Date.now(),
          qualifyingActivityIds,
          bonusActivityId,
        });

        // Auto-award linked badges
        const linkedBadges = await ctx.db
          .query("badges")
          .withIndex("achievementId", (q) =>
            q.eq("achievementId", achievement._id)
          )
          .collect();

        for (const badge of linkedBadges) {
          const existingUserBadge = await ctx.db
            .query("userBadges")
            .withIndex("userBadge", (q) =>
              q.eq("userId", userId).eq("badgeId", badge._id)
            )
            .first();
          if (!existingUserBadge) {
            await ctx.db.insert("userBadges", {
              challengeId,
              userId,
              badgeId: badge._id,
              awardedAt: Date.now(),
            });
          }
        }

        // Credit bonus points
        await ctx.db.patch(participation._id, {
          totalPoints: participation.totalPoints + achievement.bonusPoints,
          updatedAt: Date.now(),
        });

        // Look up user name for logging
        const user = await ctx.db.get(userId);
        const userName = user?.name ?? userId;
        console.log(`Awarded "${achievement.name}" to ${userName}`);
        totalAwarded++;
      }
    }

    console.log(`Backfill complete: ${totalAwarded} achievement(s) awarded`);
    return { awarded: totalAwarded };
  },
});
