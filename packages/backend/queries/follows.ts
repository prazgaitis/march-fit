import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Check if the current user is following a specific user
 */
export const isFollowing = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return false;
    }

    const follow = await ctx.db
      .query("follows")
      .withIndex("followerFollowing", (q) =>
        q.eq("followerId", currentUser._id).eq("followingId", args.userId)
      )
      .first();

    return follow !== null;
  },
});

/**
 * Get follow counts for a user
 */
export const getCounts = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const [followers, following] = await Promise.all([
      ctx.db
        .query("follows")
        .withIndex("followingId", (q) => q.eq("followingId", args.userId))
        .collect(),
      ctx.db
        .query("follows")
        .withIndex("followerId", (q) => q.eq("followerId", args.userId))
        .collect(),
    ]);

    return {
      followers: followers.length,
      following: following.length,
    };
  },
});

/**
 * Get followers of a user
 */
export const getFollowers = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const follows = await ctx.db
      .query("follows")
      .withIndex("followingId", (q) => q.eq("followingId", args.userId))
      .order("desc")
      .take(limit);

    const followers = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followerId);
        if (!user) return null;

        return {
          id: user._id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          followedAt: follow.createdAt,
        };
      })
    );

    return followers.filter((f): f is NonNullable<typeof f> => f !== null);
  },
});

/**
 * Get users that a user is following
 */
export const getFollowing = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const follows = await ctx.db
      .query("follows")
      .withIndex("followerId", (q) => q.eq("followerId", args.userId))
      .order("desc")
      .take(limit);

    const following = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followingId);
        if (!user) return null;

        return {
          id: user._id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          followedAt: follow.createdAt,
        };
      })
    );

    return following.filter((f): f is NonNullable<typeof f> => f !== null);
  },
});

/**
 * Get follow status and counts for a user profile
 */
export const getProfileFollowData = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get counts
    const [followers, following, currentUser] = await Promise.all([
      ctx.db
        .query("follows")
        .withIndex("followingId", (q) => q.eq("followingId", args.userId))
        .collect(),
      ctx.db
        .query("follows")
        .withIndex("followerId", (q) => q.eq("followerId", args.userId))
        .collect(),
      getCurrentUser(ctx),
    ]);

    // Check if current user is following this user
    let isFollowing = false;
    let isOwnProfile = false;

    if (currentUser) {
      isOwnProfile = currentUser._id === args.userId;

      if (!isOwnProfile) {
        const follow = await ctx.db
          .query("follows")
          .withIndex("followerFollowing", (q) =>
            q.eq("followerId", currentUser._id).eq("followingId", args.userId)
          )
          .first();

        isFollowing = follow !== null;
      }
    }

    return {
      followersCount: followers.length,
      followingCount: following.length,
      isFollowing,
      isOwnProfile,
    };
  },
});
