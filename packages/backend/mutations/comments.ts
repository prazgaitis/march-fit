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

    const commentId = await ctx.db.insert("comments", {
      activityId: args.activityId,
      userId: user._id,
      content: args.content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Notify activity owner logic could go here

    return commentId;
  },
});



