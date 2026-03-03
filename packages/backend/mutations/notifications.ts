import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Mark all unread notifications as read for a user.
 */
export const markAllAsRead = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    const unread = notifications.filter((n) => !n.readAt);
    const now = Date.now();

    await Promise.all(
      unread.map((n) => ctx.db.patch(n._id, { readAt: now }))
    );

    return { marked: unread.length };
  },
});
