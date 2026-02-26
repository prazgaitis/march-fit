import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

export const toggle = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("likes")
      .withIndex("activityUserUnique", (q) =>
        q.eq("activityId", args.activityId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    } else {
      const now = Date.now();
      await ctx.db.insert("likes", {
        activityId: args.activityId,
        userId: user._id,
        createdAt: now,
      });

      // Notify the activity owner (skip self-likes)
      const activity = await ctx.db.get(args.activityId);
      if (activity && activity.userId !== user._id) {
        await ctx.db.insert("notifications", {
          userId: activity.userId,
          actorId: user._id,
          type: "like",
          data: { activityId: args.activityId },
          createdAt: now,
        });
      }

      return { liked: true };
    }
  },
});



