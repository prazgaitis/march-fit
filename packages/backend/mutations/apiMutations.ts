/**
 * Internal mutations for the HTTP API.
 *
 * These are equivalents of the public mutations but accept an explicit userId
 * instead of relying on Better Auth session identity. The HTTP API layer
 * authenticates via API key and passes the resolved userId here.
 */
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { extractMentionedUserIds } from "../lib/mentions";
import { internal as internalApi } from "../_generated/api";
import {
  calculateFinalActivityScore,
} from "../lib/scoring";
import { isPaymentRequired } from "../lib/payments";
import { dateOnlyToUtcMs, coerceDateOnlyToString, formatDateOnlyFromUtcMs } from "../lib/dateOnly";
import { getChallengeWeekNumber } from "../lib/weeks";
import { notDeleted } from "../lib/activityFilters";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";
import { applyParticipationScoreDeltaAndRecomputeStreak } from "../lib/participationScoring";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Log an activity on behalf of a user (API key authenticated).
 * Mirrors the logic in mutations/activities.ts:log but takes userId explicitly.
 */
export const logActivityForUser = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    activityTypeId: v.id("activityTypes"),
    loggedDate: v.string(),
    metrics: v.optional(v.any()),
    notes: v.optional(v.string()),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("apple_health")
    ),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) throw new Error("User not found");

    // Validate participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error("You are not part of this challenge");
    }

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (isPaymentRequired(paymentConfig) && participation.paymentStatus !== "paid") {
      throw new Error("Payment required to log activities");
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const activityType = await ctx.db.get(args.activityTypeId);
    if (!activityType || activityType.challengeId !== args.challengeId) {
      throw new Error("Activity type not found or does not belong to this challenge");
    }

    const loggedDateTs = Date.parse(args.loggedDate);

    // Validate date
    const challengeStartStr = coerceDateOnlyToString(challenge.startDate);
    const loggedDateStr = formatDateOnlyFromUtcMs(loggedDateTs);
    if (loggedDateStr < challengeStartStr) {
      throw new Error(`Cannot log activities before the challenge starts on ${challengeStartStr}`);
    }

    // Enforce validWeeks
    if (activityType.validWeeks && activityType.validWeeks.length > 0) {
      const weekNumber = getChallengeWeekNumber(challenge.startDate, loggedDateTs);
      if (!activityType.validWeeks.includes(weekNumber)) {
        throw new Error(
          `This activity type is only available during week(s) ${activityType.validWeeks.join(", ")}. Current week: ${weekNumber}`
        );
      }
    }

    // Enforce maxPerChallenge
    if (activityType.maxPerChallenge !== undefined && activityType.maxPerChallenge > 0) {
      const existingCount = await ctx.db
        .query("activities")
        .withIndex("userId", (q) => q.eq("userId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("challengeId"), args.challengeId),
            q.eq(q.field("activityTypeId"), args.activityTypeId),
            notDeleted(q)
          )
        )
        .collect();

      if (existingCount.length >= activityType.maxPerChallenge) {
        throw new Error(
          `You have already logged this activity ${existingCount.length} time(s). Maximum allowed: ${activityType.maxPerChallenge}`
        );
      }
    }

    // Calculate points
    const metricsObj = args.metrics ?? {};
    const selectedOptionalBonuses = metricsObj["selectedBonuses"] as string[] | undefined;
    const score = await calculateFinalActivityScore(
      activityType,
      {
        ctx,
        metrics: metricsObj,
        userId: args.userId,
        challengeId: args.challengeId,
        loggedDate: new Date(loggedDateTs),
      },
      {
        selectedOptionalBonuses,
        includeMediaBonus: false, // No media via API for now
      }
    );
    const basePoints = score.basePoints;
    const totalBonusPoints = score.bonusPoints;
    const pointsEarned = score.pointsEarned;
    const triggeredBonuses = score.triggeredBonuses;

    const activityId = await ctx.db.insert("activities", {
      userId: args.userId,
      challengeId: args.challengeId,
      activityTypeId: args.activityTypeId,
      loggedDate: loggedDateTs,
      metrics: args.metrics ?? {},
      notes: args.notes,
      source: args.source,
      pointsEarned,
      triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
      flagged: false,
      adminCommentVisibility: "internal",
      resolutionStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Recompute streaks from all challenge days after any new activity.
    const streakUpdate = await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
      userId: args.userId,
      challengeId: args.challengeId,
      pointsDelta: pointsEarned,
      streakMinPoints: challenge.streakMinPoints,
    });
    const currentStreak = streakUpdate?.currentStreak ?? participation.currentStreak;

      return {
        id: activityId,
        pointsEarned,
        basePoints,
        bonusPoints: totalBonusPoints,
        triggeredBonuses: triggeredBonuses.map((b) => b.description),
        streakUpdate: {
          currentStreak,
          days: participation.currentStreak !== currentStreak ? 1 : 0,
        },
      };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.apiMutations.logActivityForUser",
        startedAt,
        challengeId: String(args.challengeId),
        userId: String(args.userId),
      });
    }
  },
});

/**
 * Delete an activity on behalf of a user (API key authenticated).
 */
export const removeActivityForUser = internalMutation({
  args: {
    userId: v.id("users"),
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedChallengeId: string | undefined;
    let resolvedTargetUserId: string | undefined;
    try {
      const actor = await ctx.db.get(args.userId);
      if (!actor) throw new Error("User not found");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");
    if (activity.deletedAt) return { deleted: true };

      const challenge = await ctx.db.get(activity.challengeId);
      if (!challenge) throw new Error("Challenge not found");
      resolvedChallengeId = String(activity.challengeId);
      resolvedTargetUserId = String(activity.userId);

    const canDelete =
      actor.role === "admin" ||
      challenge.creatorId === actor._id ||
      activity.userId === actor._id;
    if (!canDelete) {
      throw new Error("Not authorized to delete activity");
    }

    const now = Date.now();
    await ctx.db.patch(args.activityId, {
      deletedAt: now,
      deletedById: actor._id,
      deletedReason: "manual",
      updatedAt: now,
    });

    await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
      userId: activity.userId,
      challengeId: activity.challengeId,
      pointsDelta: -activity.pointsEarned,
      streakMinPoints: challenge.streakMinPoints,
      now,
    });

      return { deleted: true };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.apiMutations.removeActivityForUser",
        startedAt,
        challengeId: resolvedChallengeId,
        userId: resolvedTargetUserId,
      });
    }
  },
});

/**
 * Create a challenge on behalf of a user (API key authenticated).
 */
export const createChallengeForUser = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    durationDays: v.number(),
    streakMinPoints: v.number(),
    weekCalcMethod: v.string(),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const startDateMs = dateOnlyToUtcMs(args.startDate);
    const endDateMs = dateOnlyToUtcMs(args.endDate);
    if (!Number.isFinite(startDateMs) || !Number.isFinite(endDateMs)) {
      throw new Error("Invalid start or end date");
    }
    if (endDateMs < startDateMs) {
      throw new Error("End date must be after start date");
    }

    const now = Date.now();
    const challengeId = await ctx.db.insert("challenges", {
      name: args.name,
      description: args.description,
      creatorId: args.userId,
      startDate: args.startDate,
      endDate: args.endDate,
      durationDays: args.durationDays,
      streakMinPoints: args.streakMinPoints,
      weekCalcMethod: args.weekCalcMethod,
      visibility: args.visibility,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("userChallenges", {
      challengeId,
      userId: args.userId,
      joinedAt: now,
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: "paid",
      updatedAt: now,
    });

    return challengeId;
  },
});

/**
 * Update a challenge on behalf of an admin user (API key authenticated).
 */
export const updateChallengeForUser = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    streakMinPoints: v.optional(v.number()),
    weekCalcMethod: v.optional(v.string()),
    welcomeVideoUrl: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    announcement: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const { userId, challengeId, ...updates } = args;

    const current = await ctx.db.get(challengeId);
    if (!current) throw new Error("Challenge not found");

    // Validate dates if provided
    if (updates.startDate !== undefined && updates.endDate !== undefined) {
      const startDateMs = dateOnlyToUtcMs(updates.startDate);
      const endDateMs = dateOnlyToUtcMs(updates.endDate);
      if (!Number.isFinite(startDateMs) || !Number.isFinite(endDateMs)) {
        throw new Error("Invalid start or end date");
      }
      if (endDateMs < startDateMs) {
        throw new Error("End date must be after start date");
      }
    }

    // Calculate durationDays if dates change
    let durationDays = current.durationDays;
    const newStartDate = updates.startDate ?? current.startDate;
    const newEndDate = updates.endDate ?? current.endDate;
    if (updates.startDate !== undefined || updates.endDate !== undefined) {
      durationDays = Math.ceil(
        (dateOnlyToUtcMs(newEndDate) - dateOnlyToUtcMs(newStartDate)) / DAY_MS
      );
    }

    const now = Date.now();
    const updateData: Record<string, any> = { updatedAt: now, durationDays };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.startDate !== undefined) updateData.startDate = updates.startDate;
    if (updates.endDate !== undefined) updateData.endDate = updates.endDate;
    if (updates.streakMinPoints !== undefined) updateData.streakMinPoints = updates.streakMinPoints;
    if (updates.weekCalcMethod !== undefined) updateData.weekCalcMethod = updates.weekCalcMethod;
    if (updates.welcomeVideoUrl !== undefined) updateData.welcomeVideoUrl = updates.welcomeVideoUrl;
    if (updates.welcomeMessage !== undefined) updateData.welcomeMessage = updates.welcomeMessage;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;

    if (updates.announcement !== undefined) {
      updateData.announcement = updates.announcement;
      if (updates.announcement !== current.announcement) {
        updateData.announcementUpdatedAt = now;
      }
    }

    await ctx.db.patch(challengeId, updateData);
    return { success: true };
  },
});

/**
 * Resolve a flagged activity on behalf of an admin (API key authenticated).
 */
export const resolveFlagForUser = internalMutation({
  args: {
    userId: v.id("users"),
    activityId: v.id("activities"),
    status: v.union(v.literal("pending"), v.literal("resolved")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) throw new Error("Activity not found");

    const now = Date.now();
    await ctx.db.patch(args.activityId, {
      resolutionStatus: args.status,
      resolutionNotes: args.notes,
      resolvedAt: args.status === "resolved" ? now : undefined,
      resolvedById: args.status === "resolved" ? args.userId : undefined,
      flagged: args.status !== "resolved",
      updatedAt: now,
    });

    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: args.userId,
      actionType: "resolution",
      payload: { status: args.status, notes: args.notes ?? null },
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Add admin comment on behalf of an admin (API key authenticated).
 */
export const addAdminCommentForUser = internalMutation({
  args: {
    userId: v.id("users"),
    activityId: v.id("activities"),
    comment: v.string(),
    visibility: v.union(v.literal("internal"), v.literal("participant")),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) throw new Error("Activity not found");

    const now = Date.now();
    await ctx.db.patch(args.activityId, {
      adminComment: args.comment,
      adminCommentVisibility: args.visibility,
      updatedAt: now,
    });

    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: args.userId,
      actionType: "comment",
      payload: { comment: args.comment, visibility: args.visibility },
      createdAt: now,
    });

    if (args.visibility === "participant") {
      await ctx.db.insert("notifications", {
        userId: activity.userId,
        actorId: args.userId,
        type: "admin_comment",
        data: { activityId: args.activityId, comment: args.comment },
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Update a participant's role in a challenge (API key authenticated).
 */
export const updateParticipantRoleForUser = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    targetUserId: v.id("users"),
    role: v.union(v.literal("member"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.userId);
    if (!actor) throw new Error("User not found");

    // Check admin authorization
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const isGlobalAdmin = actor.role === "admin";
    const isCreator = challenge.creatorId === actor._id;

    let isChallengeAdmin = false;
    if (!isGlobalAdmin && !isCreator) {
      const actorParticipation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", args.userId).eq("challengeId", args.challengeId)
        )
        .first();
      isChallengeAdmin = actorParticipation?.role === "admin";
    }

    if (!isGlobalAdmin && !isCreator && !isChallengeAdmin) {
      throw new Error("Not authorized - challenge admin required");
    }

    // Find target user's participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.targetUserId).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error("Target user is not a participant in this challenge");
    }

    await ctx.db.patch(participation._id, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return { success: true, userId: args.targetUserId, role: args.role };
  },
});

/**
 * Create an activity type for a challenge (API key authenticated, admin only).
 */
export const createActivityTypeForUser = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    name: v.string(),
    description: v.optional(v.string()),
    scoringConfig: v.any(),
    contributesToStreak: v.boolean(),
    isNegative: v.boolean(),
    bonusThresholds: v.optional(
      v.array(
        v.object({
          metric: v.string(),
          threshold: v.number(),
          bonusPoints: v.number(),
          description: v.string(),
        })
      )
    ),
    maxPerChallenge: v.optional(v.number()),
    validWeeks: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const { userId, ...rest } = args;
    const now = Date.now();
    const activityTypeId = await ctx.db.insert("activityTypes", {
      ...rest,
      createdAt: now,
      updatedAt: now,
    });
    return activityTypeId;
  },
});

/**
 * Update an activity type (API key authenticated, admin only).
 */
export const updateActivityTypeForUser = internalMutation({
  args: {
    userId: v.id("users"),
    activityTypeId: v.id("activityTypes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    scoringConfig: v.optional(v.any()),
    contributesToStreak: v.optional(v.boolean()),
    isNegative: v.optional(v.boolean()),
    bonusThresholds: v.optional(
      v.array(
        v.object({
          metric: v.string(),
          threshold: v.number(),
          bonusPoints: v.number(),
          description: v.string(),
        })
      )
    ),
    maxPerChallenge: v.optional(v.number()),
    validWeeks: v.optional(v.array(v.number())),
    sortOrder: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const { userId, activityTypeId, ...updates } = args;

    const activityType = await ctx.db.get(activityTypeId);
    if (!activityType) throw new Error("Activity type not found");

    const updateData: Record<string, any> = { updatedAt: Date.now() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.scoringConfig !== undefined) updateData.scoringConfig = updates.scoringConfig;
    if (updates.contributesToStreak !== undefined) updateData.contributesToStreak = updates.contributesToStreak;
    if (updates.isNegative !== undefined) updateData.isNegative = updates.isNegative;
    if (updates.bonusThresholds !== undefined) updateData.bonusThresholds = updates.bonusThresholds;
    if (updates.maxPerChallenge !== undefined) updateData.maxPerChallenge = updates.maxPerChallenge;
    if (updates.validWeeks !== undefined) updateData.validWeeks = updates.validWeeks;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;

    await ctx.db.patch(activityTypeId, updateData);
    return { success: true };
  },
});

/**
 * Admin edit activity on behalf of an admin (API key authenticated).
 */
export const adminEditActivityForUser = internalMutation({
  args: {
    userId: v.id("users"),
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
    let resolvedTargetUserId: string | undefined;
    try {
      const activity = await ctx.db.get(args.activityId);
      if (!activity || activity.deletedAt) throw new Error("Activity not found");
      resolvedChallengeId = String(activity.challengeId);
      resolvedTargetUserId = String(activity.userId);
      const challenge = await ctx.db.get(activity.challengeId);
      if (!challenge) throw new Error("Challenge not found");

    const now = Date.now();
    const updates: Record<string, unknown> = { updatedAt: now };
    const changes: Record<string, unknown> = {};
    let pointsDiff = 0;
    let shouldRecomputeStreak = false;

    if (args.activityTypeId !== undefined) {
      const newType = await ctx.db.get(args.activityTypeId);
      if (!newType || newType.challengeId !== activity.challengeId) {
        throw new Error("Activity type not found or does not belong to this challenge");
      }
      updates.activityTypeId = args.activityTypeId;
      changes.activityTypeId = { from: activity.activityTypeId, to: args.activityTypeId };
      shouldRecomputeStreak = true;
    }

    if (args.pointsEarned !== undefined) {
      pointsDiff = args.pointsEarned - activity.pointsEarned;
      updates.pointsEarned = args.pointsEarned;
      changes.pointsEarned = { from: activity.pointsEarned, to: args.pointsEarned };
      shouldRecomputeStreak = true;
    }

    if (args.notes !== undefined) {
      updates.notes = args.notes;
      changes.notes = { from: activity.notes, to: args.notes };
    }

    if (args.loggedDate !== undefined) {
      updates.loggedDate = Date.parse(args.loggedDate);
      changes.loggedDate = { from: activity.loggedDate, to: updates.loggedDate };
      shouldRecomputeStreak = true;
    }

    if (args.metrics !== undefined) {
      updates.metrics = args.metrics;
      changes.metrics = { from: activity.metrics, to: args.metrics };
      shouldRecomputeStreak = true;
    }

    await ctx.db.patch(args.activityId, updates);

    if (shouldRecomputeStreak || pointsDiff !== 0) {
      await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
        userId: activity.userId,
        challengeId: activity.challengeId,
        pointsDelta: pointsDiff,
        streakMinPoints: challenge.streakMinPoints,
        now,
      });
    }

    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: args.userId,
      actionType: "edit",
      payload: changes,
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: activity.userId,
      actorId: args.userId,
      type: "admin_edit",
      data: { activityId: args.activityId, changes },
      createdAt: now,
    });

      return { success: true };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.apiMutations.adminEditActivityForUser",
        startedAt,
        challengeId: resolvedChallengeId,
        userId: resolvedTargetUserId,
      });
    }
  },
});

// ─── Forum Post Mutations (API key authenticated) ───────────────────────────

/**
 * Create a forum post on behalf of a user (API key authenticated).
 */
export const createForumPostForUser = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    title: v.optional(v.string()),
    content: v.string(),
    parentPostId: v.optional(v.id("forumPosts")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    if (!args.content.trim()) {
      throw new Error("Post content cannot be empty");
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation && user.role !== "admin" && challenge.creatorId !== user._id) {
      throw new Error("Must be a challenge participant to post");
    }

    if (args.parentPostId) {
      const parentPost = await ctx.db.get(args.parentPostId);
      if (!parentPost || parentPost.deletedAt) {
        throw new Error("Parent post not found");
      }
      if (parentPost.challengeId !== args.challengeId) {
        throw new Error("Parent post belongs to a different challenge");
      }
    }

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

    const mentionedUserIds = extractMentionedUserIds(args.content);
    if (mentionedUserIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internalApi.mutations.forumPosts.sendMentionNotifications,
        {
          postId,
          actorId: user._id,
          challengeId: args.challengeId,
          mentionedUserIds,
        },
      );
    }

    return postId;
  },
});

/**
 * Update a forum post on behalf of a user (API key authenticated).
 */
export const updateForumPostForUser = internalMutation({
  args: {
    userId: v.id("users"),
    postId: v.id("forumPosts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) throw new Error("Post not found");

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
 * Soft-delete a forum post on behalf of a user (API key authenticated).
 */
export const removeForumPostForUser = internalMutation({
  args: {
    userId: v.id("users"),
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) throw new Error("Post not found");

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
    return { deleted: true };
  },
});

/**
 * Toggle upvote on a forum post on behalf of a user (API key authenticated).
 */
export const toggleForumUpvoteForUser = internalMutation({
  args: {
    userId: v.id("users"),
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) throw new Error("Post not found");

    const existing = await ctx.db
      .query("forumPostUpvotes")
      .withIndex("postUserUnique", (q) =>
        q.eq("postId", args.postId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { upvoted: false };
    } else {
      await ctx.db.insert("forumPostUpvotes", {
        postId: args.postId,
        userId: user._id,
        createdAt: Date.now(),
      });
      return { upvoted: true };
    }
  },
});

/**
 * Toggle pin on a forum post on behalf of an admin (API key authenticated).
 */
export const toggleForumPinForUser = internalMutation({
  args: {
    userId: v.id("users"),
    postId: v.id("forumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const post = await ctx.db.get(args.postId);
    if (!post || post.deletedAt) throw new Error("Post not found");

    if (post.parentPostId) {
      throw new Error("Only top-level posts can be pinned");
    }

    const challenge = await ctx.db.get(post.challengeId);
    if (!challenge) throw new Error("Challenge not found");

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
