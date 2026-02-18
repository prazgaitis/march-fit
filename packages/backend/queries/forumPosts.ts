import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUser } from "../lib/ids";

/**
 * List forum posts for a challenge (top-level only).
 * Returns pinned posts first, then by creation date descending.
 */
export const listByChallenge = query({
  args: {
    challengeId: v.id("challenges"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    // Fetch all top-level posts for this challenge
    const result = await ctx.db
      .query("forumPosts")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page
        .filter((post) => !post.parentPostId && !post.deletedAt)
        .map(async (post) => {
          const [user, upvotes, replies] = await Promise.all([
            ctx.db.get(post.userId),
            ctx.db
              .query("forumPostUpvotes")
              .withIndex("postId", (q) => q.eq("postId", post._id))
              .collect(),
            ctx.db
              .query("forumPosts")
              .withIndex("parentPostId", (q) =>
                q.eq("parentPostId", post._id)
              )
              .collect()
              .then((r) => r.filter((p) => !p.deletedAt)),
          ]);

          const upvotedByUser = currentUser
            ? upvotes.some((u) => u.userId === currentUser._id)
            : false;

          return {
            post,
            user: user
              ? {
                  id: user._id,
                  username: user.username,
                  name: user.name,
                  avatarUrl: user.avatarUrl,
                }
              : null,
            upvoteCount: upvotes.length,
            replyCount: replies.length,
            upvotedByUser,
          };
        })
    );

    // Sort: pinned first, then by createdAt descending
    const sorted = page
      .filter((item) => item.user !== null)
      .sort((a, b) => {
        if (a.post.isPinned && !b.post.isPinned) return -1;
        if (!a.post.isPinned && b.post.isPinned) return 1;
        return b.post.createdAt - a.post.createdAt;
      });

    return {
      ...result,
      page: sorted,
    };
  },
});

/**
 * Get a single forum post by ID with its replies and upvote data.
 */
export const getById = query({
  args: {
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) {
      return null;
    }

    const [user, upvotes, challenge] = await Promise.all([
      ctx.db.get(post.userId),
      ctx.db
        .query("forumPostUpvotes")
        .withIndex("postId", (q) => q.eq("postId", post._id))
        .collect(),
      ctx.db.get(post.challengeId),
    ]);

    if (!user || !challenge) {
      return null;
    }

    // Fetch replies
    const replies = await ctx.db
      .query("forumPosts")
      .withIndex("parentPostId", (q) => q.eq("parentPostId", post._id))
      .collect();

    const repliesWithData = await Promise.all(
      replies
        .filter((r) => !r.deletedAt)
        .map(async (reply) => {
          const [replyUser, replyUpvotes] = await Promise.all([
            ctx.db.get(reply.userId),
            ctx.db
              .query("forumPostUpvotes")
              .withIndex("postId", (q) => q.eq("postId", reply._id))
              .collect(),
          ]);

          const upvotedByUser = currentUser
            ? replyUpvotes.some((u) => u.userId === currentUser._id)
            : false;

          return {
            post: reply,
            user: replyUser
              ? {
                  id: replyUser._id,
                  username: replyUser.username,
                  name: replyUser.name,
                  avatarUrl: replyUser.avatarUrl,
                }
              : null,
            upvoteCount: replyUpvotes.length,
            upvotedByUser,
          };
        })
    );

    const upvotedByUser = currentUser
      ? upvotes.some((u) => u.userId === currentUser._id)
      : false;

    // Check admin status
    let isAdmin = false;
    if (currentUser) {
      if (currentUser.role === "admin" || challenge.creatorId === currentUser._id) {
        isAdmin = true;
      } else {
        const participation = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", currentUser._id).eq("challengeId", post.challengeId)
          )
          .first();
        isAdmin = participation?.role === "admin";
      }
    }

    return {
      post,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      upvoteCount: upvotes.length,
      upvotedByUser,
      isAdmin,
      isAuthor: currentUser ? currentUser._id === post.userId : false,
      replies: repliesWithData
        .filter((r) => r.user !== null)
        .sort((a, b) => a.post.createdAt - b.post.createdAt),
    };
  },
});

/**
 * Admin: List all forum posts for a challenge (including deleted) for moderation.
 */
export const listForAdmin = query({
  args: {
    challengeId: v.id("challenges"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check admin
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    let isAdmin = user.role === "admin" || challenge.creatorId === user._id;
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", args.challengeId)
        )
        .first();
      isAdmin = participation?.role === "admin";
    }

    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const result = await ctx.db
      .query("forumPosts")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page
        .filter((post) => !post.parentPostId) // Only top-level
        .map(async (post) => {
          const [postUser, upvotes, replies] = await Promise.all([
            ctx.db.get(post.userId),
            ctx.db
              .query("forumPostUpvotes")
              .withIndex("postId", (q) => q.eq("postId", post._id))
              .collect(),
            ctx.db
              .query("forumPosts")
              .withIndex("parentPostId", (q) =>
                q.eq("parentPostId", post._id)
              )
              .collect(),
          ]);

          return {
            post,
            user: postUser
              ? {
                  id: postUser._id,
                  username: postUser.username,
                  name: postUser.name,
                  avatarUrl: postUser.avatarUrl,
                }
              : null,
            upvoteCount: upvotes.length,
            replyCount: replies.filter((r) => !r.deletedAt).length,
          };
        })
    );

    // Sort: pinned first, then by createdAt descending
    const sorted = page
      .filter((item) => item.user !== null)
      .sort((a, b) => {
        if (a.post.isPinned && !b.post.isPinned) return -1;
        if (!a.post.isPinned && b.post.isPinned) return 1;
        return b.post.createdAt - a.post.createdAt;
      });

    return {
      ...result,
      page: sorted,
    };
  },
});
