import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    showInCategoryLeaderboard: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("categories", {
      name: args.name,
      description: args.description,
      sortOrder: args.sortOrder,
      showInCategoryLeaderboard: args.showInCategoryLeaderboard,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

export const updateInternal = internalMutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    showInCategoryLeaderboard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { categoryId, ...updates } = args;

    const category = await ctx.db.get(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.showInCategoryLeaderboard !== undefined)
      updateData.showInCategoryLeaderboard = updates.showInCategoryLeaderboard;

    await ctx.db.patch(categoryId, updateData);

    return { success: true };
  },
});

/**
 * Public mutation for admin UI — update a category's settings.
 * Auth is enforced at the page level (admin layout).
 */
export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    showInCategoryLeaderboard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { categoryId, ...updates } = args;

    const category = await ctx.db.get(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.showInCategoryLeaderboard !== undefined)
      updateData.showInCategoryLeaderboard = updates.showInCategoryLeaderboard;

    await ctx.db.patch(categoryId, updateData);

    return { success: true };
  },
});
