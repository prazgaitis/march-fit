import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const create = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    categoryId: v.id("categories"),
    scoringConfig: v.any(),
    contributesToStreak: v.boolean(),
    isNegative: v.boolean(),
    bonusThresholds: v.optional(
      v.array(
        v.object({
          metric: v.string(),
          threshold: v.number(),
          bonusPoints: v.number(),
          description: v.string(),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("templateActivityTypes", {
      name: args.name,
      description: args.description,
      categoryId: args.categoryId,
      scoringConfig: args.scoringConfig,
      contributesToStreak: args.contributesToStreak,
      isNegative: args.isNegative,
      bonusThresholds: args.bonusThresholds,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});



