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

const kindArg = v.optional(
  v.union(
    v.literal("core"),
    v.literal("challenge"),
    v.literal("bonus"),
    v.literal("penalty"),
    v.literal("tracking"),
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
    kind: kindArg,
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
    kind: kindArg,
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
      kind: args.kind,
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
    kind: kindArg,
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
    if (updates.kind !== undefined) updateData.kind = updates.kind;
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
    kind: kindArg,
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
    if (updates.kind !== undefined) updateData.kind = updates.kind;
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

// Public mutation for deleting an activity type (admin UI)
// Blocked if any activities have been logged against this type.
export const deleteActivityType = mutation({
  args: {
    activityTypeId: v.id("activityTypes"),
  },
  handler: async (ctx, args) => {
    const activityType = await ctx.db.get(args.activityTypeId);
    if (!activityType) throw new Error("Activity type not found");

    // Count activities referencing this type (non-deleted)
    const linked = await ctx.db
      .query("activities")
      .withIndex("activityTypeId", (q) =>
        q.eq("activityTypeId", args.activityTypeId)
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    if (linked.length > 0) {
      throw new Error(
        `Cannot delete: ${linked.length} activit${linked.length === 1 ? "y has" : "ies have"} been logged against this type.`
      );
    }

    // Safe to delete
    await ctx.db.delete(args.activityTypeId);
    return { success: true };
  },
});

/**
 * Backfill the `kind` field on all activity types for a challenge.
 * Uses heuristics based on name, scoringConfig, isNegative, and contributesToStreak.
 * Safe to run multiple times — only patches rows where kind is undefined.
 */
export const backfillKind = mutation({
  args: {
    challengeId: v.id("challenges"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const BONUS_NAMES = new Set([
      "partner week bonus",
      "pr week bonus",
      "the hunt bonus",
      "hunt week bonus",
      "category leader bonus",
      "mini-game bonus",
    ]);

    const TRACKING_NAMES = new Set([
      "10 days of mindfulness (days 1-9)",
      "10 days of mindfulness (day 10)",
    ]);

    const results: { name: string; kind: string; skipped?: boolean }[] = [];

    for (const at of activityTypes) {
      if (at.kind !== undefined) {
        results.push({ name: at.name, kind: at.kind, skipped: true });
        continue;
      }

      const nameLower = at.name.toLowerCase();
      let kind: "core" | "challenge" | "bonus" | "penalty" | "tracking";

      if (at.isNegative) {
        kind = "penalty";
      } else if (BONUS_NAMES.has(nameLower)) {
        kind = "bonus";
      } else if (TRACKING_NAMES.has(nameLower)) {
        kind = "tracking";
      } else if (
        at.scoringConfig?.type === "variable" ||
        (at.scoringConfig?.type === "fixed" && at.scoringConfig?.basePoints === 0)
      ) {
        // Variable scoring = system-awarded bonuses
        kind = "bonus";
      } else if (
        at.scoringConfig?.type === "unit_based" &&
        ["miles", "kilometers", "minutes"].includes(at.scoringConfig?.unit) &&
        !at.maxPerChallenge
      ) {
        // Repeatable distance/duration activities = core fitness
        kind = "core";
      } else {
        // Everything else: completion workouts, tiered challenges, etc.
        kind = "challenge";
      }

      if (!args.dryRun) {
        await ctx.db.patch(at._id, { kind });
      }
      results.push({ name: at.name, kind });
    }

    return {
      total: activityTypes.length,
      updated: results.filter((r) => !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
    };
  },
});

export const batchAssignCategories = internalMutation({
  args: {
    assignments: v.array(
      v.object({
        activityTypeId: v.id("activityTypes"),
        categoryId: v.id("categories"),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const { activityTypeId, categoryId } of args.assignments) {
      await ctx.db.patch(activityTypeId, { categoryId });
    }
    return { updated: args.assignments.length };
  },
});
