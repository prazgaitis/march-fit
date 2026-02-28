import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migrate a batch of activities: copy externalData to the companion table
 * and clear it from the activity document.
 */
export const migrateBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        activityId: v.id("activities"),
        externalData: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let migrated = 0;
    for (const row of args.rows) {
      // Skip if companion row already exists (idempotent)
      const existing = await ctx.db
        .query("activityExternalData")
        .withIndex("activityId", (q) => q.eq("activityId", row.activityId))
        .first();
      if (!existing) {
        await ctx.db.insert("activityExternalData", {
          activityId: row.activityId,
          externalData: row.externalData,
        });
      }

      // Clear externalData from the activity document
      await ctx.db.patch(row.activityId, { externalData: undefined });
      migrated++;
    }
    return migrated;
  },
});
