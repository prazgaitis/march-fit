import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

export const create = mutation({
  args: {
    activityId: v.id("activities"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (!args.content.trim()) {
        throw new Error("Comment cannot be empty");
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      activityId: args.activityId,
      userId: user._id,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });

    // Notify the activity owner (skip self-comments)
    const activity = await ctx.db.get(args.activityId);
    if (activity && activity.userId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: activity.userId,
        actorId: user._id,
        type: "comment",
        data: { activityId: args.activityId },
        createdAt: now,
      });
    }

    return commentId;
  },
});



