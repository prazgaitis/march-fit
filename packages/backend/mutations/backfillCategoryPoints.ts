import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Delete a batch of categoryPoints rows by ID.
 * Used by the backfill action to clear stale data before re-aggregating.
 */
export const deleteBatch = internalMutation({
  args: { ids: v.array(v.id("categoryPoints")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
  },
});

/**
 * Insert a batch of pre-aggregated categoryPoints rows.
 * Used by the backfill action to write fresh aggregations.
 */
export const upsertBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        challengeId: v.id("challenges"),
        userId: v.id("users"),
        categoryId: v.id("categories"),
        totalPoints: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const row of args.rows) {
      await ctx.db.insert("categoryPoints", {
        challengeId: row.challengeId,
        userId: row.userId,
        categoryId: row.categoryId,
        totalPoints: row.totalPoints,
        updatedAt: now,
      });
    }
    return args.rows.length;
  },
});
