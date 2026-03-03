import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "../lib/ids";
import { insertNotification } from "../lib/notifications";
import { recomputeFeedScore } from "../lib/feedScore";

async function assertChallengeAdmin(
  ctx: MutationCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  userRole: "user" | "admin"
) {
  if (userRole === "admin") return;

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.creatorId === userId) return;

  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .first();

  if (participation?.role !== "admin") {
    throw new Error("Not authorized - challenge admin required");
  }
}

/**
 * Create a comment on an activity (backward-compatible entry point).
 */
export const create = mutation({
  args: {
    activityId: v.id("activities"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (!args.content.trim()) {
      throw new Error("Comment cannot be empty");
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      parentType: "activity",
      activityId: args.activityId,
      userId: user._id,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });

    // Notify the activity owner (skip self-comments, dedup within rollup window)
    const activity = await ctx.db.get(args.activityId);
    if (activity && activity.userId !== user._id) {
      await insertNotification(ctx, {
        userId: activity.userId,
        actorId: user._id,
        type: "comment",
        data: { activityId: args.activityId },
        createdAt: now,
      });
    }

    // Recompute feed score after new comment
    await recomputeFeedScore(ctx, args.activityId);

    return commentId;
  },
});

/**
 * Create a comment on a feedback item. Reporter and admins can comment.
 */
export const createOnFeedback = mutation({
  args: {
    feedbackId: v.id("feedback"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (!args.content.trim()) {
      throw new Error("Comment cannot be empty");
    }

    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");

    // Allow the reporter or any challenge admin
    const isReporter = feedback.userId === user._id;
    if (!isReporter) {
      await assertChallengeAdmin(ctx, user._id, feedback.challengeId, user.role);
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      parentType: "feedback",
      feedbackId: args.feedbackId,
      userId: user._id,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });

    // Notify the other party (reporter ↔ admin)
    const notifyUserId = isReporter
      ? undefined // reporter posted — we'd need to notify admins, handled below
      : feedback.userId; // admin posted — notify reporter

    if (notifyUserId && notifyUserId !== user._id) {
      await insertNotification(ctx, {
        userId: notifyUserId,
        actorId: user._id,
        type: "feedback_comment",
        data: {
          feedbackId: args.feedbackId,
          challengeId: feedback.challengeId,
          title: feedback.title ?? feedback.description.slice(0, 60),
        },
        createdAt: now,
      });
    }

    return commentId;
  },
});

/**
 * Create an admin comment on a flagged activity.
 * Inserts into comments table and activityFlagHistory audit log.
 */
export const createOnFlaggedActivity = mutation({
  args: {
    activityId: v.id("activities"),
    comment: v.string(),
    visibility: v.union(v.literal("internal"), v.literal("participant")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (!args.comment.trim()) {
      throw new Error("Comment cannot be empty");
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) throw new Error("Activity not found");

    await assertChallengeAdmin(ctx, user._id, activity.challengeId, user.role);

    const now = Date.now();

    // Insert comment
    const commentId = await ctx.db.insert("comments", {
      parentType: "flagged_activity",
      activityId: args.activityId,
      userId: user._id,
      content: args.comment,
      visibility: args.visibility,
      createdAt: now,
      updatedAt: now,
    });

    // Also patch the legacy field for backward compat
    await ctx.db.patch(args.activityId, {
      adminComment: args.comment,
      adminCommentVisibility: args.visibility,
      updatedAt: now,
    });

    // Add history entry
    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: user._id,
      actionType: "comment",
      payload: {
        comment: args.comment,
        visibility: args.visibility,
      },
      createdAt: now,
    });

    // Notify participant if visibility is "participant"
    if (args.visibility === "participant") {
      await insertNotification(ctx, {
        userId: activity.userId,
        actorId: user._id,
        type: "admin_comment",
        data: {
          activityId: args.activityId,
          comment: args.comment,
        },
        createdAt: now,
      });
    }

    return commentId;
  },
});
