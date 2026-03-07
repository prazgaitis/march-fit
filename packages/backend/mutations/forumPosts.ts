import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import { extractMentionedUserIds } from "../lib/mentions";
import { internal } from "../_generated/api";

/**
 * Create a new forum post (top-level or reply).
 * User must be a participant in the challenge.
 */
export const create = mutation({
  args: {
    challengeId: v.id("challenges"),
    title: v.optional(v.string()),
    content: v.string(),
    parentPostId: v.optional(v.id("forumPosts")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (!args.content.trim()) {
      throw new Error("Post content cannot be empty");
    }

    // Check challenge exists
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Check user is a participant
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation && user.role !== "admin" && challenge.creatorId !== user._id) {
      throw new Error("Must be a challenge participant to post");
    }

    // If replying, verify parent exists and belongs to same challenge
    if (args.parentPostId) {
      const parentPost = await ctx.db.get(args.parentPostId);
      if (!parentPost || parentPost.deletedAt) {
        throw new Error("Parent post not found");
      }
      if (parentPost.challengeId !== args.challengeId) {
        throw new Error("Parent post belongs to a different challenge");
      }
    }

    // Top-level posts require a title
    if (!args.parentPostId && !args.title?.trim()) {
      throw new Error("Top-level posts require a title");
    }

    const now = Date.now();
    const postId = await ctx.db.insert("forumPosts", {
      challengeId: args.challengeId,
      userId: user._id,
      title: args.parentPostId ? undefined : args.title,
      content: args.content.trim(),
      parentPostId: args.parentPostId,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    });

    // Send mention notifications async
    const mentionedUserIds = extractMentionedUserIds(args.content);
    if (mentionedUserIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.mutations.forumPosts.sendMentionNotifications,
        {
          postId,
          actorId: user._id,
          challengeId: args.challengeId,
          mentionedUserIds,
        },
      );
    }

    if (args.parentPostId) {
      // Notify the parent post author of the reply
      await ctx.scheduler.runAfter(
        0,
        internal.mutations.forumPosts.sendReplyNotification,
        {
          postId,
          parentPostId: args.parentPostId,
          actorId: user._id,
          challengeId: args.challengeId,
        },
      );
    } else {
      // Notify all challenge participants of the new top-level post
      await ctx.scheduler.runAfter(
        0,
        internal.mutations.forumPosts.sendNewPostNotifications,
        {
          postId,
          actorId: user._id,
          challengeId: args.challengeId,
        },
      );
    }

    return postId;
  },
});

/**
 * Update a forum post. Only the author or admins can edit.
 */
export const update = mutation({
  args: {
    postId: v.id("forumPosts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) {
      throw new Error("Post not found");
    }

    // Check authorization: author or admin
    const isAuthor = post.userId === user._id;
    let isAdmin = user.role === "admin";
    if (!isAdmin) {
      const challenge = await ctx.db.get(post.challengeId);
      if (challenge && challenge.creatorId === user._id) {
        isAdmin = true;
      }
    }
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", post.challengeId)
        )
        .first();
      if (participation?.role === "admin") {
        isAdmin = true;
      }
    }

    if (!isAuthor && !isAdmin) {
      throw new Error("Not authorized to edit this post");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.content !== undefined) {
      if (!args.content.trim()) {
        throw new Error("Post content cannot be empty");
      }
      updates.content = args.content.trim();
    }
    if (args.title !== undefined && !post.parentPostId) {
      updates.title = args.title;
    }

    await ctx.db.patch(args.postId, updates);
    return args.postId;
  },
});

/**
 * Soft-delete a forum post. Only the author or admins can delete.
 */
export const remove = mutation({
  args: {
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) {
      throw new Error("Post not found");
    }

    // Check authorization: author or admin
    const isAuthor = post.userId === user._id;
    let isAdmin = user.role === "admin";
    if (!isAdmin) {
      const challenge = await ctx.db.get(post.challengeId);
      if (challenge && challenge.creatorId === user._id) {
        isAdmin = true;
      }
    }
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", post.challengeId)
        )
        .first();
      if (participation?.role === "admin") {
        isAdmin = true;
      }
    }

    if (!isAuthor && !isAdmin) {
      throw new Error("Not authorized to delete this post");
    }

    await ctx.db.patch(args.postId, { deletedAt: Date.now() });
    return args.postId;
  },
});

/**
 * Toggle upvote on a forum post.
 */
export const toggleUpvote = mutation({
  args: {
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) {
      throw new Error("Post not found");
    }

    const existing = await ctx.db
      .query("forumPostUpvotes")
      .withIndex("postUserUnique", (q) =>
        q.eq("postId", args.postId).eq("userId", user._id)
      )
      .first();

    // Explicitly allow self-upvotes; some communities treat this differently.
    // We allow it here and only toggle this user's own vote state.
    if (existing) {
      await ctx.db.delete(existing._id);
      return { upvoted: false };
    } else {
      try {
        await ctx.db.insert("forumPostUpvotes", {
          postId: args.postId,
          userId: user._id,
          createdAt: Date.now(),
        });
      } catch (error) {
        // Handle duplicate-key races from rapid repeat clicks as already-upvoted.
        const duplicate = await ctx.db
          .query("forumPostUpvotes")
          .withIndex("postUserUnique", (q) =>
            q.eq("postId", args.postId).eq("userId", user._id)
          )
          .first();
        if (!duplicate) {
          throw error;
        }
      }
      return { upvoted: true };
    }
  },
});

/**
 * Toggle pin status on a forum post. Admin only.
 */
export const togglePin = mutation({
  args: {
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) {
      throw new Error("Post not found");
    }

    // Only top-level posts can be pinned
    if (post.parentPostId) {
      throw new Error("Only top-level posts can be pinned");
    }

    // Check admin status
    const challenge = await ctx.db.get(post.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    let isAdmin = user.role === "admin" || challenge.creatorId === user._id;
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", post.challengeId)
        )
        .first();
      isAdmin = participation?.role === "admin";
    }

    if (!isAdmin) {
      throw new Error("Only admins can pin posts");
    }

    await ctx.db.patch(args.postId, { isPinned: !post.isPinned });
    return { isPinned: !post.isPinned };
  },
});

/**
 * Internal: create a forum post directly (for seeding).
 */
export const internalCreate = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    title: v.optional(v.string()),
    content: v.string(),
    parentPostId: v.optional(v.id("forumPosts")),
    isPinned: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("forumPosts", {
      challengeId: args.challengeId,
      userId: args.userId,
      title: args.title,
      content: args.content,
      parentPostId: args.parentPostId,
      isPinned: args.isPinned ?? false,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

/**
 * Internal: send a reply notification to the parent post author.
 */
export const sendReplyNotification = internalMutation({
  args: {
    postId: v.id("forumPosts"),
    parentPostId: v.id("forumPosts"),
    actorId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const parentPost = await ctx.db.get(args.parentPostId);
    if (!parentPost || parentPost.deletedAt) return;

    // Don't notify if the author is replying to their own post
    if (parentPost.userId === args.actorId) return;

    await ctx.db.insert("notifications", {
      userId: parentPost.userId,
      actorId: args.actorId,
      type: "forum_reply",
      data: {
        postId: args.postId,
        parentPostId: args.parentPostId,
        challengeId: args.challengeId,
      },
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal: notify all challenge participants of a new top-level forum post.
 */
export const sendNewPostNotifications = internalMutation({
  args: {
    postId: v.id("forumPosts"),
    actorId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all participants in the challenge
    const participations = await ctx.db
      .query("userChallenges")
      .filter((q) => q.eq(q.field("challengeId"), args.challengeId))
      .collect();

    for (const participation of participations) {
      // Don't notify the author
      if (participation.userId === args.actorId) continue;

      await ctx.db.insert("notifications", {
        userId: participation.userId,
        actorId: args.actorId,
        type: "forum_new_post",
        data: {
          postId: args.postId,
          challengeId: args.challengeId,
        },
        createdAt: now,
      });
    }
  },
});

/**
 * Internal: send mention notifications for a forum post.
 */
export const sendMentionNotifications = internalMutation({
  args: {
    postId: v.id("forumPosts"),
    actorId: v.id("users"),
    challengeId: v.id("challenges"),
    mentionedUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const userId of args.mentionedUserIds) {
      // Skip self-mentions
      if (userId === args.actorId) continue;

      // Verify the user exists
      const user = await ctx.db.get(userId as any);
      if (!user) continue;

      await ctx.db.insert("notifications", {
        userId: userId as any,
        actorId: args.actorId,
        type: "forum_mention",
        data: { postId: args.postId, challengeId: args.challengeId },
        createdAt: now,
      });
    }
  },
});
