import { mutation } from "../_generated/server";
import { v } from "convex/values";

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
