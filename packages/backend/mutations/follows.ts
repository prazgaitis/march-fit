import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Follow a user
 */
export const follow = mutation({
  args: {
    userId: v.id("users"), // The user to follow
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Can't follow yourself
    if (currentUser._id === args.userId) {
      throw new Error("Cannot follow yourself");
    }

    // Check if target user exists
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("followerFollowing", (q) =>
        q.eq("followerId", currentUser._id).eq("followingId", args.userId)
      )
      .first();

    if (existingFollow) {
      return { success: true, alreadyFollowing: true };
    }

    // Create follow relationship
    await ctx.db.insert("follows", {
      followerId: currentUser._id,
      followingId: args.userId,
      createdAt: Date.now(),
    });

    // Create notification for the followed user
    await ctx.db.insert("notifications", {
      userId: args.userId,
      actorId: currentUser._id,
      type: "new_follower",
      data: {},
      createdAt: Date.now(),
    });

    return { success: true, alreadyFollowing: false };
  },
});

/**
 * Unfollow a user
 */
export const unfollow = mutation({
  args: {
    userId: v.id("users"), // The user to unfollow
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Find the follow relationship
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("followerFollowing", (q) =>
        q.eq("followerId", currentUser._id).eq("followingId", args.userId)
      )
      .first();

    if (!existingFollow) {
      return { success: true, wasFollowing: false };
    }

    // Delete the follow relationship
    await ctx.db.delete(existingFollow._id);

    return { success: true, wasFollowing: true };
  },
});

/**
 * Toggle follow status (follow if not following, unfollow if following)
 */
export const toggle = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Can't follow yourself
    if (currentUser._id === args.userId) {
      throw new Error("Cannot follow yourself");
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("followerFollowing", (q) =>
        q.eq("followerId", currentUser._id).eq("followingId", args.userId)
      )
      .first();

    if (existingFollow) {
      // Unfollow
      await ctx.db.delete(existingFollow._id);
      return { isFollowing: false };
    } else {
      // Follow
      const targetUser = await ctx.db.get(args.userId);
      if (!targetUser) {
        throw new Error("User not found");
      }

      await ctx.db.insert("follows", {
        followerId: currentUser._id,
        followingId: args.userId,
        createdAt: Date.now(),
      });

      // Create notification
      await ctx.db.insert("notifications", {
        userId: args.userId,
        actorId: currentUser._id,
        type: "new_follower",
        data: {},
        createdAt: Date.now(),
      });

      return { isFollowing: true };
    }
  },
});
