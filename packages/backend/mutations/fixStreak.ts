import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation to fix contributesToStreak values by activity type name
 */
export const fixContributesToStreak = internalMutation({
  args: {
    fixes: v.array(
      v.object({
        name: v.string(),
        contributesToStreak: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results: { name: string; activityTypesUpdated: number; templateUpdated: boolean }[] = [];
    const now = Date.now();

    for (const fix of args.fixes) {
      // Update all activityTypes with this name
      const activityTypes = await ctx.db
        .query("activityTypes")
        .filter((q) => q.eq(q.field("name"), fix.name))
        .collect();

      for (const at of activityTypes) {
        await ctx.db.patch(at._id, {
          contributesToStreak: fix.contributesToStreak,
          updatedAt: now,
        });
      }

      // Update templateActivityTypes with this name
      const template = await ctx.db
        .query("templateActivityTypes")
        .filter((q) => q.eq(q.field("name"), fix.name))
        .first();

      if (template) {
        await ctx.db.patch(template._id, {
          contributesToStreak: fix.contributesToStreak,
          updatedAt: now,
        });
      }

      results.push({
        name: fix.name,
        activityTypesUpdated: activityTypes.length,
        templateUpdated: !!template,
      });
    }

    return { success: true, results };
  },
});
