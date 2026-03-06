import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all users who liked an activity, ordered by most recent first.
 */
export const getLikers = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const likes = await ctx.db
      .query("likes")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .collect();

    // Sort newest first
    likes.sort((a, b) => b.createdAt - a.createdAt);

    const likers = await Promise.all(
      likes.map(async (like) => {
        const user = await ctx.db.get(like.userId);
        if (!user) return null;
        return {
          id: user._id,
          name: user.name ?? null,
          username: user.username,
          avatarUrl: user.avatarUrl ?? null,
        };
      }),
    );

    return likers.filter((u) => u !== null);
  },
});
