import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUser } from "../lib/ids";

async function enrichComments(
  ctx: QueryCtx,
  comments: Doc<"comments">[],
  currentUserId?: Id<"users">,
) {
  return Promise.all(
    comments.map(async (comment) => {
      const [user, likes] = await Promise.all([
        ctx.db.get(comment.userId),
        ctx.db
          .query("commentLikes")
          .withIndex("commentId", (q) => q.eq("commentId", comment._id))
          .collect(),
      ]);

      const likedByMe = currentUserId
        ? likes.some((l) => l.userId === currentUserId)
        : false;

      return {
        comment: {
          id: comment._id,
          parentType: comment.parentType ?? "activity",
          activityId: comment.activityId,
          feedbackId: comment.feedbackId,
          userId: comment.userId,
          content: comment.content,
          visibility: comment.visibility,
          createdAt: new Date(comment.createdAt).toISOString(),
        },
        author: user
          ? {
              id: user._id,
              name: user.name,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }
          : null,
        likeCount: likes.length,
        likedByMe,
      };
    }),
  );
}

// Get comments for a specific activity (backward-compatible)
export const getByActivityId = query({
  args: {
    activityId: v.id("activities"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Use the compound index to filter by parentType at the DB level so that
    // cursors are stable. In-memory filtering after paginate() caused
    // InvalidCursor errors when flagged_activity/feedback comments were
    // interleaved in the activityId index.
    // The backfillCommentParentType migration ensures old comments have
    // parentType = "activity" so none are missed.
    const comments = await ctx.db
      .query("comments")
      .withIndex("activityIdByType", (q) =>
        q.eq("activityId", args.activityId).eq("parentType", "activity"),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const enriched = await enrichComments(ctx, comments.page, user?._id);
    const page = enriched.filter((item) => item.author !== null).map((item) => ({
      ...item,
      author: item.author!,
    }));

    return {
      ...comments,
      page,
    };
  },
});

// Get comments for a feedback item
export const getByFeedbackId = query({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");

    const comments = await ctx.db
      .query("comments")
      .withIndex("feedbackId", (q) => q.eq("feedbackId", args.feedbackId))
      .order("asc")
      .collect();

    const feedbackComments = comments.filter(
      (c) => c.parentType === "feedback",
    );

    const enriched = await enrichComments(ctx, feedbackComments, user._id);
    return enriched.filter((item) => item.author !== null).map((item) => ({
      ...item,
      author: item.author!,
    }));
  },
});

// Get admin comments for a flagged activity
export const getByFlaggedActivity = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    // Check if user is admin for the challenge
    let isAdmin = user.role === "admin";
    if (!isAdmin) {
      const challenge = await ctx.db.get(activity.challengeId);
      if (challenge && challenge.creatorId === user._id) {
        isAdmin = true;
      }
    }
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", activity.challengeId)
        )
        .first();
      if (participation?.role === "admin") {
        isAdmin = true;
      }
    }

    let flaggedComments = await ctx.db
      .query("comments")
      .withIndex("activityIdByType", (q) =>
        q.eq("activityId", args.activityId).eq("parentType", "flagged_activity"),
      )
      .order("asc")
      .collect();

    // Non-admins only see participant-visible comments
    if (!isAdmin) {
      flaggedComments = flaggedComments.filter(
        (c) => c.visibility === "participant",
      );
    }

    const enriched = await enrichComments(ctx, flaggedComments, user._id);
    return enriched.filter((item) => item.author !== null).map((item) => ({
      ...item,
      author: item.author!,
    }));
  },
});
