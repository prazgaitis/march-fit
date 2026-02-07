import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get category by name (internal - for seeding)
 */
export const getByName = internalQuery({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
  },
});

/**
 * Get all categories
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

/**
 * Get categories for a challenge via activity types
 * Note: This mimics the behavior of getChallengeCategories which finds categories used in a challenge
 */
export const getChallengeCategories = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const activityTypes = await ctx.db
        .query("activityTypes")
        .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
        .collect();
    
    const categoryIds = new Set<string>();
    activityTypes.forEach(at => {
        if (at.categoryId) categoryIds.add(at.categoryId);
    });

    const categories = await Promise.all(
        Array.from(categoryIds).map(id => ctx.db.get(id as any))
    );

    return categories.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});
