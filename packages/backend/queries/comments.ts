import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// Get comments for a specific activity
export const getByActivityId = query({
  args: {
    activityId: v.id("activities"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      comments.page.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          comment: {
            id: comment._id,
            activityId: comment.activityId,
            userId: comment.userId,
            content: comment.content,
            createdAt: new Date(comment.createdAt).toISOString(),
          },
          author: user ? {
            id: user._id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
          } : null,
        };
      })
    );

    return {
      ...comments,
      page: page.filter((item) => item.author !== null).map(item => ({...item, author: item.author!})),
    };
  },
});
