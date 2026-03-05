import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import { insertNotification } from "../lib/notifications";

export const toggle = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("commentLikes")
      .withIndex("commentUserUnique", (q) =>
        q.eq("commentId", args.commentId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    } else {
      const now = Date.now();
      await ctx.db.insert("commentLikes", {
        commentId: args.commentId,
        userId: user._id,
        createdAt: now,
      });

      // Notify comment author (skip self-likes)
      const comment = await ctx.db.get(args.commentId);
      if (comment && comment.userId !== user._id) {
        await insertNotification(ctx, {
          userId: comment.userId,
          actorId: user._id,
          type: "comment_like",
          data: {
            commentId: args.commentId,
            ...(comment.activityId ? { activityId: comment.activityId } : {}),
          },
          createdAt: now,
        });
      }

      return { liked: true };
    }
  },
});
