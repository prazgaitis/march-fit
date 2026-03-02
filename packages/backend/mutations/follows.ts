import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireCurrentUser } from "../lib/ids";

const LIKE_AFFINITY_WEIGHT = 2;
const COMMENT_AFFINITY_WEIGHT = 4;
const MAX_AFFINITY_SCORE = 100;
type AffinityActivityDoc = {
  challengeId: Id<"challenges">;
  userId: Id<"users">;
  deletedAt?: number;
};

/**
 * Follow a user
 */
export const follow = mutation({
  args: {
    userId: v.id("users"), // The user to follow
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

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
    const currentUser = await requireCurrentUser(ctx);

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
    const currentUser = await requireCurrentUser(ctx);

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

/**
 * Internal cron mutation:
 * Incrementally compute challenge-scoped user affinities from new likes/comments.
 * This is intentionally cron-driven so likes/comments writes remain lightweight.
 */
export const recomputeAffinitiesFromInteractions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const state = await ctx.db
      .query("affinityProcessingState")
      .withIndex("scope", (q) => q.eq("scope", "global"))
      .first();

    if (!state) {
      await ctx.db.insert("affinityProcessingState", {
        scope: "global",
        lastLikesAt: now,
        lastCommentsAt: now,
        updatedAt: now,
      });
      return {
        initialized: true,
        likesProcessed: 0,
        commentsProcessed: 0,
        affinityRowsUpdated: 0,
      };
    }

    const [likes, comments] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("createdAt", (q) => q.gt("createdAt", state.lastLikesAt))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("createdAt", (q) => q.gt("createdAt", state.lastCommentsAt))
        .collect(),
    ]);

    const activityCache = new Map<Id<"activities">, AffinityActivityDoc | null>();
    const deltas = new Map<
      string,
      {
        challengeId: Id<"challenges">;
        viewerUserId: Id<"users">;
        authorUserId: Id<"users">;
        delta: number;
      }
    >();

    const addDelta = (
      challengeId: Id<"challenges">,
      viewerUserId: Id<"users">,
      authorUserId: Id<"users">,
      delta: number,
    ) => {
      const key = `${challengeId}:${viewerUserId}:${authorUserId}`;
      const existing = deltas.get(key);
      if (existing) {
        existing.delta += delta;
      } else {
        deltas.set(key, { challengeId, viewerUserId, authorUserId, delta });
      }
    };

    for (const like of likes) {
      let activity = activityCache.get(like.activityId as Id<"activities">);
      if (activity === undefined) {
        activity = (await ctx.db.get(
          like.activityId as Id<"activities">,
        )) as AffinityActivityDoc | null;
        activityCache.set(like.activityId as Id<"activities">, activity);
      }
      if (!activity || activity.deletedAt) continue;
      if (like.userId === activity.userId) continue;
      addDelta(
        activity.challengeId,
        like.userId,
        activity.userId,
        LIKE_AFFINITY_WEIGHT,
      );
    }

    for (const comment of comments) {
      let activity = activityCache.get(comment.activityId as Id<"activities">);
      if (activity === undefined) {
        activity = (await ctx.db.get(
          comment.activityId as Id<"activities">,
        )) as AffinityActivityDoc | null;
        activityCache.set(comment.activityId as Id<"activities">, activity);
      }
      if (!activity || activity.deletedAt) continue;
      if (comment.userId === activity.userId) continue;
      addDelta(
        activity.challengeId,
        comment.userId,
        activity.userId,
        COMMENT_AFFINITY_WEIGHT,
      );
    }

    let affinityRowsUpdated = 0;
    for (const row of deltas.values()) {
      if (row.delta <= 0) continue;
      const existing = await ctx.db
        .query("userAffinities")
        .withIndex("challengeViewerAuthor", (q) =>
          q
            .eq("challengeId", row.challengeId)
            .eq("viewerUserId", row.viewerUserId)
            .eq("authorUserId", row.authorUserId),
        )
        .first();

      if (existing) {
        const nextScore = Math.min(MAX_AFFINITY_SCORE, existing.score + row.delta);
        if (nextScore !== existing.score) {
          await ctx.db.patch(existing._id, {
            score: nextScore,
            updatedAt: now,
          });
          affinityRowsUpdated += 1;
        }
      } else {
        await ctx.db.insert("userAffinities", {
          challengeId: row.challengeId,
          viewerUserId: row.viewerUserId,
          authorUserId: row.authorUserId,
          score: Math.min(MAX_AFFINITY_SCORE, row.delta),
          updatedAt: now,
        });
        affinityRowsUpdated += 1;
      }
    }

    const maxLikeCreatedAt = likes.reduce(
      (max, like) => Math.max(max, like.createdAt),
      state.lastLikesAt,
    );
    const maxCommentCreatedAt = comments.reduce(
      (max, comment) => Math.max(max, comment.createdAt),
      state.lastCommentsAt,
    );

    await ctx.db.patch(state._id, {
      lastLikesAt: maxLikeCreatedAt,
      lastCommentsAt: maxCommentCreatedAt,
      updatedAt: now,
    });

    return {
      initialized: false,
      likesProcessed: likes.length,
      commentsProcessed: comments.length,
      affinityRowsUpdated,
    };
  },
});
