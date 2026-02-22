import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";
import type { Id } from "../_generated/dataModel";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";
import { applyParticipationScoreDeltaAndRecomputeStreak } from "../lib/participationScoring";
import { dateOnlyToUtcMs, normalizeDateOnlyInput } from "../lib/dateOnly";
import { deleteActivity, patchActivity } from "../lib/activityWrites";

async function requireChallengeAdminForActivity(
  ctx: { db: any; auth: any },
  activityId: Id<"activities">,
) {
  const user = await getCurrentUser(ctx as any);
  if (!user) {
    throw new Error("Not authenticated");
  }

  const activity = await ctx.db.get(activityId);
  if (!activity || activity.deletedAt) {
    throw new Error("Activity not found");
  }

  const challenge = await ctx.db.get(activity.challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  const isGlobalAdmin = user.role === "admin";
  const isCreator = challenge.creatorId === user._id;
  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", user._id).eq("challengeId", activity.challengeId),
    )
    .first();
  const isChallengeAdmin = participation?.role === "admin";

  if (!isGlobalAdmin && !isCreator && !isChallengeAdmin) {
    throw new Error("Not authorized - challenge admin required");
  }

  return { user, activity };
}

// Internal mutation to delete a challenge and all related data (for scripts/migrations)
export const deleteChallenge = internalMutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return { success: false, error: "Challenge not found" };
    }

    // Delete related data in order
    // 1. Activities
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    for (const activity of activities) {
      // Delete likes for this activity
      const likes = await ctx.db
        .query("likes")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      for (const like of likes) {
        await ctx.db.delete(like._id);
      }
      // Delete comments for this activity
      const comments = await ctx.db
        .query("comments")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }
      await deleteActivity(ctx, activity._id);
    }

    // 2. Activity types
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    for (const at of activityTypes) {
      await ctx.db.delete(at._id);
    }

    // 3. User challenges (participations)
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    for (const p of participations) {
      await ctx.db.delete(p._id);
    }

    // 4. Bonus rules
    const bonusRules = await ctx.db
      .query("bonusRules")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    for (const br of bonusRules) {
      await ctx.db.delete(br._id);
    }

    // 5. Finally delete the challenge
    await ctx.db.delete(args.challengeId);

    return { success: true, deletedChallenge: challenge.name };
  },
});

// Update resolution status of a flagged activity
export const updateFlagResolution = mutation({
  args: {
    activityId: v.id("activities"),
    status: v.union(
      v.literal("pending"),
      v.literal("resolved")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireChallengeAdminForActivity(ctx, args.activityId);

    const now = Date.now();

    // Update activity
    await patchActivity(ctx, args.activityId, {
      resolutionStatus: args.status,
      resolutionNotes: args.notes,
      resolvedAt: args.status === "resolved" ? now : undefined,
      resolvedById: args.status === "resolved" ? user._id : undefined,
      flagged: args.status !== "resolved",
      updatedAt: now,
    });

    // Add history entry
    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: user._id,
      actionType: "resolution",
      payload: {
        status: args.status,
        notes: args.notes ?? null,
      },
      createdAt: now,
    });

    return { success: true };
  },
});

// Add admin comment to an activity
export const addAdminComment = mutation({
  args: {
    activityId: v.id("activities"),
    comment: v.string(),
    visibility: v.union(v.literal("internal"), v.literal("participant")),
  },
  handler: async (ctx, args) => {
    const { user, activity } = await requireChallengeAdminForActivity(
      ctx,
      args.activityId,
    );

    const now = Date.now();

    // Update activity with admin comment
    await patchActivity(ctx, args.activityId, {
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

    // Create notification for participant if visibility is "participant"
    if (args.visibility === "participant") {
      await ctx.db.insert("notifications", {
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

    return { success: true };
  },
});

// Admin edit activity details
export const adminEditActivity = mutation({
  args: {
    activityId: v.id("activities"),
    activityTypeId: v.optional(v.id("activityTypes")),
    pointsEarned: v.optional(v.number()),
    notes: v.optional(v.union(v.string(), v.null())),
    loggedDate: v.optional(v.string()),
    metrics: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedChallengeId: string | undefined;
    let resolvedUserId: string | undefined;
    try {
      const { user, activity } = await requireChallengeAdminForActivity(
        ctx,
        args.activityId,
      );
      resolvedChallengeId = String(activity.challengeId);
      resolvedUserId = String(activity.userId);
      const challenge = await ctx.db.get(activity.challengeId);
      if (!challenge) {
        throw new Error("Challenge not found");
      }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    // Track changes for history
    const changes: Record<string, unknown> = {};

    let pointsDiff = 0;
    let shouldRecomputeStreak = false;

    if (args.activityTypeId !== undefined) {
      const newType = await ctx.db.get(args.activityTypeId);
      if (!newType || newType.challengeId !== activity.challengeId) {
        throw new Error(
          "Activity type not found or does not belong to this challenge"
        );
      }

      updates.activityTypeId = args.activityTypeId;
      changes.activityTypeId = {
        from: activity.activityTypeId,
        to: args.activityTypeId,
      };
      shouldRecomputeStreak = true;
    }

    if (args.pointsEarned !== undefined) {
      // Calculate points difference for participation update
      pointsDiff = args.pointsEarned - activity.pointsEarned;

      updates.pointsEarned = args.pointsEarned;
      changes.pointsEarned = {
        from: activity.pointsEarned,
        to: args.pointsEarned,
      };
      shouldRecomputeStreak = true;
    }

    if (args.notes !== undefined) {
      updates.notes = args.notes;
      changes.notes = { from: activity.notes, to: args.notes };
    }

    if (args.loggedDate !== undefined) {
      updates.loggedDate = dateOnlyToUtcMs(normalizeDateOnlyInput(args.loggedDate));
      changes.loggedDate = {
        from: activity.loggedDate,
        to: updates.loggedDate,
      };
      shouldRecomputeStreak = true;
    }

    if (args.metrics !== undefined) {
      updates.metrics = args.metrics;
      changes.metrics = { from: activity.metrics, to: args.metrics };
      shouldRecomputeStreak = true;
    }

    // Update activity
    await patchActivity(ctx, args.activityId, updates);

    if (shouldRecomputeStreak || pointsDiff !== 0) {
      await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
        userId: activity.userId,
        challengeId: activity.challengeId,
        pointsDelta: pointsDiff,
        streakMinPoints: (challenge as any).streakMinPoints,
        now,
      });
    }

    // Add history entry
    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: user._id,
      actionType: "edit",
      payload: changes,
      createdAt: now,
    });

    // Create notification for participant
    await ctx.db.insert("notifications", {
      userId: activity.userId,
      actorId: user._id,
      type: "admin_edit",
      data: {
        activityId: args.activityId,
        changes,
      },
      createdAt: now,
    });

      return { success: true };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.admin.adminEditActivity",
        startedAt,
        challengeId: resolvedChallengeId,
        userId: resolvedUserId,
      });
    }
  },
});
