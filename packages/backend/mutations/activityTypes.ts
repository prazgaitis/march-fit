import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

const bonusThresholdsArg = v.optional(
  v.array(
    v.object({
      metric: v.string(),
      threshold: v.number(),
      bonusPoints: v.number(),
      description: v.string(),
    })
  )
);

// Internal mutation for seeding
export const create = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    templateId: v.optional(v.id("templateActivityTypes")),
    name: v.string(),
    description: v.optional(v.string()),
    scoringConfig: v.any(),
    contributesToStreak: v.boolean(),
    isNegative: v.boolean(),
    categoryId: v.optional(v.id("categories")),
    sortOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
    availableInFinalDays: v.optional(v.boolean()),
    bonusThresholds: bonusThresholdsArg,
    maxPerChallenge: v.optional(v.number()),
    validWeeks: v.optional(v.array(v.number())),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityTypes", args);
  },
});

// Public mutation for creating activity types (admin UI)
export const createActivityType = mutation({
  args: {
    challengeId: v.id("challenges"),
    templateId: v.optional(v.id("templateActivityTypes")),
    name: v.string(),
    description: v.optional(v.string()),
    scoringConfig: v.any(),
    contributesToStreak: v.boolean(),
    isNegative: v.boolean(),
    categoryId: v.optional(v.id("categories")),
    sortOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
    availableInFinalDays: v.optional(v.boolean()),
    bonusThresholds: bonusThresholdsArg,
    maxPerChallenge: v.optional(v.number()),
    validWeeks: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("activityTypes", {
      challengeId: args.challengeId,
      templateId: args.templateId,
      name: args.name,
      description: args.description,
      scoringConfig: args.scoringConfig,
      contributesToStreak: args.contributesToStreak,
      isNegative: args.isNegative,
      categoryId: args.categoryId,
      sortOrder: args.sortOrder,
      displayOrder: args.displayOrder,
      availableInFinalDays: args.availableInFinalDays,
      bonusThresholds: args.bonusThresholds,
      maxPerChallenge: args.maxPerChallenge,
      validWeeks: args.validWeeks,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal mutation for updating activity types (used by migrations/actions)
export const updateInternal = internalMutation({
  args: {
    activityTypeId: v.id("activityTypes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    scoringConfig: v.optional(v.any()),
    contributesToStreak: v.optional(v.boolean()),
    isNegative: v.optional(v.boolean()),
    categoryId: v.optional(v.id("categories")),
    sortOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
    availableInFinalDays: v.optional(v.boolean()),
    bonusThresholds: bonusThresholdsArg,
    maxPerChallenge: v.optional(v.number()),
    validWeeks: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const { activityTypeId, ...updates } = args;

    const activityType = await ctx.db.get(activityTypeId);
    if (!activityType) throw new Error("Activity type not found");

    const updateData: Record<string, any> = { updatedAt: Date.now() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.scoringConfig !== undefined) updateData.scoringConfig = updates.scoringConfig;
    if (updates.contributesToStreak !== undefined) updateData.contributesToStreak = updates.contributesToStreak;
    if (updates.isNegative !== undefined) updateData.isNegative = updates.isNegative;
    if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.displayOrder !== undefined) updateData.displayOrder = updates.displayOrder;
    if (updates.availableInFinalDays !== undefined) updateData.availableInFinalDays = updates.availableInFinalDays;
    if (updates.bonusThresholds !== undefined) updateData.bonusThresholds = updates.bonusThresholds;
    if (updates.maxPerChallenge !== undefined) updateData.maxPerChallenge = updates.maxPerChallenge;
    if (updates.validWeeks !== undefined) updateData.validWeeks = updates.validWeeks;

    await ctx.db.patch(activityTypeId, updateData);
    return { success: true };
  },
});

// Public mutation for updating activity types (admin UI)
export const updateActivityType = mutation({
  args: {
    activityTypeId: v.id("activityTypes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    scoringConfig: v.optional(v.any()),
    contributesToStreak: v.optional(v.boolean()),
    isNegative: v.optional(v.boolean()),
    categoryId: v.optional(v.id("categories")),
    sortOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
    availableInFinalDays: v.optional(v.boolean()),
    bonusThresholds: bonusThresholdsArg,
    maxPerChallenge: v.optional(v.number()),
    validWeeks: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const { activityTypeId, ...updates } = args;

    const activityType = await ctx.db.get(activityTypeId);
    if (!activityType) throw new Error("Activity type not found");

    const updateData: Record<string, any> = { updatedAt: Date.now() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.scoringConfig !== undefined) updateData.scoringConfig = updates.scoringConfig;
    if (updates.contributesToStreak !== undefined) updateData.contributesToStreak = updates.contributesToStreak;
    if (updates.isNegative !== undefined) updateData.isNegative = updates.isNegative;
    if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.displayOrder !== undefined) updateData.displayOrder = updates.displayOrder;
    if (updates.availableInFinalDays !== undefined) updateData.availableInFinalDays = updates.availableInFinalDays;
    if (updates.bonusThresholds !== undefined) updateData.bonusThresholds = updates.bonusThresholds;
    if (updates.maxPerChallenge !== undefined) updateData.maxPerChallenge = updates.maxPerChallenge;
    if (updates.validWeeks !== undefined) updateData.validWeeks = updates.validWeeks;

    await ctx.db.patch(activityTypeId, updateData);
    return { success: true };
  },
});
