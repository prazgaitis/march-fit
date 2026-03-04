import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Get the list of user IDs the current user is following
 */
export const getFollowingIds = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }

    const follows = await ctx.db
      .query("follows")
      .withIndex("followerId", (q) => q.eq("followerId", currentUser._id))
      .collect();

    return follows.map((f) => f.followingId);
  },
});

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

    let isFollowing = false;
    let isFollowedBy = false;
    let isOwnProfile = false;

    if (currentUser) {
      isOwnProfile = currentUser._id === args.userId;

      if (!isOwnProfile) {
        const [meToThem, themToMe] = await Promise.all([
          ctx.db
            .query("follows")
            .withIndex("followerFollowing", (q) =>
              q.eq("followerId", currentUser._id).eq("followingId", args.userId)
            )
            .first(),
          ctx.db
            .query("follows")
            .withIndex("followerFollowing", (q) =>
              q.eq("followerId", args.userId).eq("followingId", currentUser._id)
            )
            .first(),
        ]);

        isFollowing = meToThem !== null;
        isFollowedBy = themToMe !== null;
      }
    }

    return {
      followersCount: followers.length,
      followingCount: following.length,
      isFollowing,
      isFollowedBy,
      isOwnProfile,
    };
  },
});

/**
 * Suggest users to follow within a challenge based on challenge-scoped affinity.
 * Excludes self and already-followed users.
 */
export const getSuggestions = query({
  args: {
    challengeId: v.id("challenges"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

    const [participations, follows, affinities] = await Promise.all([
      ctx.db
        .query("userChallenges")
        .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
        .collect(),
      ctx.db
        .query("follows")
        .withIndex("followerId", (q) => q.eq("followerId", currentUser._id))
        .collect(),
      ctx.db
        .query("userAffinities")
        .withIndex("challengeViewerScore", (q) =>
          q
            .eq("challengeId", args.challengeId)
            .eq("viewerUserId", currentUser._id),
        )
        .order("desc")
        .take(limit * 5),
    ]);

    const participantIds = new Set(participations.map((p) => p.userId));
    if (!participantIds.has(currentUser._id)) {
      return [];
    }

    const alreadyFollowing = new Set(follows.map((follow) => follow.followingId));

    const suggestions: Array<{
      id: string;
      username: string;
      name: string | null;
      avatarUrl: string | null;
      affinityScore: number;
    }> = [];

    for (const affinity of affinities) {
      if (suggestions.length >= limit) break;
      const authorId = affinity.authorUserId;
      if (authorId === currentUser._id) continue;
      if (alreadyFollowing.has(authorId)) continue;
      if (!participantIds.has(authorId)) continue;
      if (affinity.score <= 0) continue;

      const user = await ctx.db.get(authorId);
      if (!user) continue;

      suggestions.push({
        id: user._id,
        username: user.username,
        name: user.name ?? null,
        avatarUrl: user.avatarUrl ?? null,
        affinityScore: affinity.score,
      });
    }

    return suggestions;
  },
});
