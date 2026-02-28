import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Delete a batch of weeklyCategoryPoints rows by ID.
 */
export const deleteBatch = internalMutation({
  args: { ids: v.array(v.id("weeklyCategoryPoints")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
  },
});

/**
 * Insert a batch of pre-aggregated weeklyCategoryPoints rows.
 */
export const upsertBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        challengeId: v.id("challenges"),
        userId: v.id("users"),
        categoryId: v.id("categories"),
        weekNumber: v.number(),
        totalPoints: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const row of args.rows) {
      await ctx.db.insert("weeklyCategoryPoints", {
        challengeId: row.challengeId,
        userId: row.userId,
        categoryId: row.categoryId,
        weekNumber: row.weekNumber,
        totalPoints: row.totalPoints,
        updatedAt: now,
      });
    }
    return args.rows.length;
  },
});
