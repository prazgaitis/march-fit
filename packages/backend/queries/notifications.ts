import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get notifications for a user
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    // Get actor data for each notification
    const result = await Promise.all(
      notifications.map(async (notification) => {
        const actor = await ctx.db.get(notification.actorId);
        return {
          id: notification._id,
          type: notification.type,
          data: notification.data,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
          actor: actor
            ? {
                id: actor._id,
                name: actor.name,
                username: actor.username,
                avatarUrl: actor.avatarUrl,
              }
            : null,
        };
      })
    );

    return result.filter((n) => n.actor !== null);
  },
});

/**
 * Get unread notification count for a user
 */
export const getUnreadCount = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    return notifications.filter((n) => !n.readAt).length;
  },
});
