import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import { calculateFinalActivityScore, extractActivityMetricValue } from "../lib/scoring";
import { requireCurrentUser } from "../lib/ids";
import {
  dateOnlyToUtcMs,
  formatDateOnlyFromUtcMs,
  normalizeDateOnlyInput,
} from "../lib/dateOnly";
import { notDeleted } from "../lib/activityFilters";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";
import { applyParticipationScoreDeltaAndRecomputeStreak } from "../lib/participationScoring";
import { insertActivity, patchActivity } from "../lib/activityWrites";
import { applyCategoryPointsDelta } from "../lib/categoryPoints";
import { applyWeeklyCategoryPointsDeltaFromDate } from "../lib/weeklyCategoryPoints";
import { recomputeFeedScore } from "../lib/feedScore";
import { insertNotification } from "../lib/notifications";
import type { Id } from "../_generated/dataModel";
import {
  checkAndAwardAchievements,
  logActivityWithLifecycle,
  softDeleteActivityWithLifecycle,
} from "../lib/activityLifecycle";

// Internal mutation for seeding
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    activityTypeId: v.id("activityTypes"),
    loggedDate: v.number(),
    metrics: v.optional(v.any()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("apple_health")
    ),
    externalId: v.optional(v.string()),
    externalData: v.optional(v.any()),
    pointsEarned: v.number(),
    flagged: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await insertActivity(ctx, {
      ...args,
      adminCommentVisibility: "internal",
      resolutionStatus: "pending",
    });
  },
});

export const logForUserInternal = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    activityTypeId: v.id("activityTypes"),
    loggedDate: v.string(),
    pointsOverride: v.optional(v.number()),
    metrics: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await logActivityWithLifecycle(ctx, {
      userId: args.userId,
      challengeId: args.challengeId,
      activityTypeId: args.activityTypeId,
      loggedDate: args.loggedDate,
      pointsOverride: args.pointsOverride,
      metrics: args.metrics,
      notes: args.notes,
      source: "manual",
    });
  },
});

export const removeInternal = internalMutation({
  args: {
    activityId: v.id("activities"),
    deletedById: v.optional(v.id("users")),
    deletedReason: v.string(),
  },
  handler: async (ctx, args) => {
    return await softDeleteActivityWithLifecycle(ctx, args);
  },
});

/**
 * Notify mini-game partners/hunters/prey when a user logs an activity.
 * - Partner Week: notify the user's partner
 * - Hunt Week: notify both the user's hunter and prey
 */
async function notifyMiniGameParticipants(
  ctx: any,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  activityId: Id<"activities">,
) {
  // Find active mini-games for this challenge
  const activeMiniGames = await ctx.db
    .query("miniGames")
    .withIndex("challengeStatus", (q: any) =>
      q.eq("challengeId", challengeId).eq("status", "active"),
    )
    .collect();

  if (activeMiniGames.length === 0) return;

  const now = Date.now();

  for (const game of activeMiniGames) {
    if (game.type !== "partner_week" && game.type !== "hunt_week") continue;

    // Find this user's participation record in the game
    const participation = await ctx.db
      .query("miniGameParticipants")
      .withIndex("miniGameUser", (q: any) =>
        q.eq("miniGameId", game._id).eq("userId", userId),
      )
      .first();

    if (!participation) continue;

    if (game.type === "partner_week" && participation.partnerUserId) {
      // Don't notify if partnered with yourself (odd number middle person)
      if (participation.partnerUserId !== userId) {
        await insertNotification(ctx, {
          userId: participation.partnerUserId,
          actorId: userId,
          type: "mini_game_partner_activity",
          data: { activityId, miniGameId: game._id, miniGameName: game.name },
          createdAt: now,
        });
      }
    }

    if (game.type === "hunt_week") {
      // Notify the user's prey (the person they're hunting)
      if (participation.preyUserId) {
        await insertNotification(ctx, {
          userId: participation.preyUserId,
          actorId: userId,
          type: "mini_game_hunter_activity",
          data: { activityId, miniGameId: game._id, miniGameName: game.name },
          createdAt: now,
        });
      }
      // Notify the user's hunter (the person hunting them)
      if (participation.hunterUserId) {
        await insertNotification(ctx, {
          userId: participation.hunterUserId,
          actorId: userId,
          type: "mini_game_prey_activity",
          data: { activityId, miniGameId: game._id, miniGameName: game.name },
          createdAt: now,
        });
      }
    }
  }
}

/**
 * Create activity tags for tagged users, notify them, and schedule
 * a background job to find related activities.
 */
async function createActivityTags(
  ctx: any,
  args: {
    activityId: Id<"activities">;
    taggerUserId: Id<"users">;
    challengeId: Id<"challenges">;
    taggedUserIds: Id<"users">[];
    loggedDate: number;
  },
) {
  const now = Date.now();
  const uniqueTaggedIds = [...new Set(args.taggedUserIds)].filter(
    (id) => id !== args.taggerUserId, // Can't tag yourself
  );

  for (const taggedUserId of uniqueTaggedIds) {
    // Verify the tagged user is a participant in this challenge
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", taggedUserId).eq("challengeId", args.challengeId),
      )
      .first();
    if (!participation) continue;

    // Check for duplicate tag
    const existing = await ctx.db
      .query("activityTags")
      .withIndex("activityTaggedUser", (q: any) =>
        q.eq("activityId", args.activityId).eq("taggedUserId", taggedUserId),
      )
      .first();
    if (existing) continue;

    await ctx.db.insert("activityTags", {
      activityId: args.activityId,
      taggedUserId,
      challengeId: args.challengeId,
      createdAt: now,
    });

    // Notify the tagged user
    await insertNotification(ctx, {
      userId: taggedUserId,
      actorId: args.taggerUserId,
      type: "activity_tag",
      data: {
        activityId: args.activityId,
        challengeId: args.challengeId,
      },
      createdAt: now,
    });
  }

  // Schedule background job to find and link related activities
  if (uniqueTaggedIds.length > 0) {
    await ctx.scheduler.runAfter(0, internal.mutations.activityTags.linkRelatedActivities, {
      activityId: args.activityId,
      challengeId: args.challengeId,
      loggedDate: args.loggedDate,
    });
  }
}

export const log = mutation({
  args: {
    challengeId: v.id("challenges"),
    activityTypeId: v.id("activityTypes"),
    loggedDate: v.string(), // date-only "YYYY-MM-DD" (or ISO timestamp with local date)
    metrics: v.optional(v.any()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    mediaIds: v.optional(v.array(v.id("_storage"))),
    cloudinaryPublicIds: v.optional(v.array(v.string())),
    // Local time & location context
    localTime: v.optional(v.string()), // "HH:MM" from user's local clock
    timezone: v.optional(v.string()), // IANA timezone (e.g., "America/Chicago")
    locationCity: v.optional(v.string()),
    locationState: v.optional(v.string()),
    locationCountry: v.optional(v.string()),
    startLatlng: v.optional(v.array(v.number())),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("apple_health")
    ),
    externalId: v.optional(v.string()),
    externalData: v.optional(v.any()),
    // Tag other users in this activity (they'll see it in their feed)
    taggedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedUserId: string | undefined;
    try {
      const user = await requireCurrentUser(ctx);
      resolvedUserId = String(user._id);

      return await logActivityWithLifecycle(ctx, {
        userId: user._id,
        challengeId: args.challengeId,
        activityTypeId: args.activityTypeId,
        loggedDate: args.loggedDate,
        metrics: args.metrics,
        notes: args.notes,
        imageUrl: args.imageUrl,
        mediaIds: args.mediaIds,
        cloudinaryPublicIds: args.cloudinaryPublicIds,
        localTime: args.localTime,
        timezone: args.timezone,
        locationCity: args.locationCity,
        locationState: args.locationState,
        locationCountry: args.locationCountry,
        startLatlng: args.startLatlng,
        source: args.source,
        externalId: args.externalId,
        externalData: args.externalData,
        taggedUserIds: args.taggedUserIds,
      });
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.activities.log",
        startedAt,
        challengeId: String(args.challengeId),
        userId: resolvedUserId,
      });
    }
  },
});

// Generate an upload URL for activity media
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Flag an activity (user-facing)
export const flagActivity = mutation({
  args: {
    activityId: v.id("activities"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) {
      throw new Error("Activity not found");
    }

    // Verify user is a participant in this challenge
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", activity.challengeId)
      )
      .first();

    if (!participation) {
      throw new ConvexError("You are not part of this challenge.");
    }

    // Allow flagging your own activity (useful for testing/self-reporting)

    // Check if user already flagged this activity
    const existingFlag = await ctx.db
      .query("flags")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .filter((q) => q.eq(q.field("flaggerUserId"), user._id))
      .first();

    if (existingFlag) {
      throw new ConvexError("You have already flagged this activity");
    }

    const now = Date.now();

    // Create flag record
    await ctx.db.insert("flags", {
      activityId: args.activityId,
      flaggerUserId: user._id,
      reason: args.reason,
      resolved: false,
      createdAt: now,
    });

    // Update the activity if not already flagged
    if (!activity.flagged) {
      await patchActivity(ctx, args.activityId, {
        flagged: true,
        flaggedAt: now,
        flaggedReason: args.reason,
        resolutionStatus: "pending",
        updatedAt: now,
      });
      // Recompute feed score (flag penalty)
      await recomputeFeedScore(ctx, args.activityId);
    }

    // Add history entry
    await ctx.db.insert("activityFlagHistory", {
      activityId: args.activityId,
      actorId: user._id,
      actionType: "flagged",
      payload: {
        reason: args.reason,
      },
      createdAt: now,
    });

    return { success: true };
  },
});

// Edit an activity (user-facing)
export const editActivity = mutation({
  args: {
    activityId: v.id("activities"),
    notes: v.optional(v.string()),
    metrics: v.optional(v.any()),
    loggedDate: v.optional(v.string()), // ISO date string "YYYY-MM-DD"
    activityTypeId: v.optional(v.id("activityTypes")),
    mediaIds: v.optional(v.array(v.id("_storage"))),
    cloudinaryPublicIds: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    // Update tagged users (replaces existing tags)
    taggedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedChallengeId: string | undefined;
    let resolvedUserId: string | undefined;
    try {
      const user = await requireCurrentUser(ctx);
      resolvedUserId = String(user._id);

      const activity = await ctx.db.get(args.activityId);
      if (!activity) {
        throw new Error("Activity not found");
      }
      resolvedChallengeId = String(activity.challengeId);

    if (activity.deletedAt) {
      throw new ConvexError("This activity has been deleted and can no longer be edited.");
    }

    if (activity.userId !== user._id) {
      throw new ConvexError("You can only edit your own activities.");
    }

    const challenge = await ctx.db.get(activity.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Determine which activity type to use
    const newActivityTypeId = args.activityTypeId ?? activity.activityTypeId;
    let activityType;
    if (args.activityTypeId && args.activityTypeId !== activity.activityTypeId) {
      activityType = await ctx.db.get(args.activityTypeId);
      if (!activityType || activityType.challengeId !== activity.challengeId) {
        throw new ConvexError("This activity type is not available for this challenge.");
      }
    } else {
      activityType = await ctx.db.get(activity.activityTypeId);
      if (!activityType) {
        throw new Error("Activity type not found");
      }
    }

    // Determine new loggedDate
    const newLoggedDateTs = args.loggedDate
      ? dateOnlyToUtcMs(normalizeDateOnlyInput(args.loggedDate))
      : activity.loggedDate;

    // Determine new metrics
    const newMetrics = args.metrics !== undefined ? args.metrics : (activity.metrics ?? {});

    // Recalculate points using the same scoring logic as `log`
    const metricsObj = newMetrics ?? {};

    const selectedOptionalBonuses = (metricsObj as Record<string, unknown>)["selectedBonuses"] as string[] | undefined;

    // Determine effective media: use provided values if given, otherwise fall back to existing.
    const effectiveMediaIds = args.mediaIds !== undefined ? args.mediaIds : activity.mediaIds;
    const effectiveCloudinaryIds = args.cloudinaryPublicIds !== undefined ? args.cloudinaryPublicIds : activity.cloudinaryPublicIds;
    const effectiveImageUrl = args.imageUrl !== undefined ? (args.imageUrl ?? undefined) : activity.imageUrl;
    const hasMedia = !!(effectiveMediaIds && effectiveMediaIds.length > 0) || !!(effectiveCloudinaryIds && effectiveCloudinaryIds.length > 0) || !!effectiveImageUrl;
    let alreadyEarnedPhotoBonusEdit = false;
    if (hasMedia) {
      const loggedDateStrEdit = formatDateOnlyFromUtcMs(newLoggedDateTs);
      const existingActivitiesForEdit = await ctx.db
        .query("activities")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("challengeId"), activity.challengeId),
            notDeleted(q)
          )
        )
        .collect();

      alreadyEarnedPhotoBonusEdit = existingActivitiesForEdit.some((a) => {
        if (a._id === args.activityId) return false; // exclude self
        const aDateStr = formatDateOnlyFromUtcMs(a.loggedDate);
        const aHasMedia = !!(a.mediaIds && a.mediaIds.length > 0) || !!(a.cloudinaryPublicIds && a.cloudinaryPublicIds.length > 0) || !!a.imageUrl;
        const aHasPhotoBonus = !!(a.triggeredBonuses?.some((b) => b.metric === "media"));
        return aDateStr === loggedDateStrEdit && aHasMedia && aHasPhotoBonus;
      });
    }
    const score = await calculateFinalActivityScore(
      activityType,
      {
        ctx,
        metrics: metricsObj,
        userId: user._id,
        challengeId: activity.challengeId,
        loggedDate: new Date(newLoggedDateTs),
      },
      {
        selectedOptionalBonuses,
        includeMediaBonus: hasMedia && !alreadyEarnedPhotoBonusEdit,
      }
    );
    const newPoints = score.pointsEarned;
    const triggeredBonuses = score.triggeredBonuses;
    const oldPoints = activity.pointsEarned;

    // Detect if user removed Strava-imported media so sync won't restore it
    const isStravaActivity = activity.source === "strava";
    const userRemovedStravaMedia =
      isStravaActivity &&
      (args.imageUrl === null || args.cloudinaryPublicIds !== undefined || args.mediaIds !== undefined) &&
      !hasMedia;

    // Patch the activity
    const now = Date.now();
    await patchActivity(ctx, args.activityId, {
      activityTypeId: newActivityTypeId,
      metrics: newMetrics,
      notes: args.notes !== undefined ? args.notes : activity.notes,
      loggedDate: newLoggedDateTs,
      pointsEarned: newPoints,
      triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
      ...(args.mediaIds !== undefined ? { mediaIds: args.mediaIds } : {}),
      ...(args.cloudinaryPublicIds !== undefined ? { cloudinaryPublicIds: args.cloudinaryPublicIds } : {}),
      ...(args.imageUrl !== undefined ? { imageUrl: args.imageUrl ?? undefined } : {}),
      ...(userRemovedStravaMedia ? { stravaMediaDismissed: true } : {}),
      updatedAt: now,
    });

    // Recompute algorithmic feed score after content change
    await recomputeFeedScore(ctx, args.activityId);

    // When the activity type changed, the category may have changed too.
    // Unapply old category points first; new category is handled via categoryId below.
    const typeChanged =
      args.activityTypeId !== undefined &&
      args.activityTypeId !== activity.activityTypeId;
    const dateChanged = newLoggedDateTs !== activity.loggedDate;
    // Weekly aggregation needs a full swap when the week or category changes.
    const weeklyNeedsSwap = typeChanged || dateChanged;

    const oldMetrics = (activity.metrics ?? {}) as Record<string, unknown>;
    const newMetricValue = extractActivityMetricValue(activityType, metricsObj);

    if (typeChanged) {
      const oldActivityType = await ctx.db.get(activity.activityTypeId);
      const oldMetricValue = oldActivityType
        ? extractActivityMetricValue(oldActivityType, oldMetrics)
        : 0;
      await applyCategoryPointsDelta(ctx, {
        userId: user._id,
        challengeId: activity.challengeId,
        categoryId: oldActivityType?.categoryId,
        pointsDelta: -oldPoints,
        metricDelta: -oldMetricValue,
        now,
      });
    }
    if (weeklyNeedsSwap) {
      const oldCatId = typeChanged
        ? (await ctx.db.get(activity.activityTypeId))?.categoryId
        : activityType.categoryId;
      const oldTypeForMetric = typeChanged
        ? await ctx.db.get(activity.activityTypeId)
        : activityType;
      const oldMetricValue = oldTypeForMetric
        ? extractActivityMetricValue(oldTypeForMetric, oldMetrics)
        : 0;
      await applyWeeklyCategoryPointsDeltaFromDate(ctx, {
        userId: user._id,
        challengeId: activity.challengeId,
        categoryId: oldCatId,
        loggedDate: activity.loggedDate,
        challengeStartDate: challenge.startDate,
        pointsDelta: -oldPoints,
        metricDelta: -oldMetricValue,
        now,
      });
    }

    // Compute metric delta for the common path (same category, same week)
    const oldMetricValueSameType = extractActivityMetricValue(activityType, oldMetrics);
    const metricDeltaForCommonPath = typeChanged
      ? undefined
      : newMetricValue - oldMetricValueSameType;

    // Update participation totalPoints + streak after activity is updated.
    // categoryId routes through the common write path for aggregation.
    await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
      userId: user._id,
      challengeId: activity.challengeId,
      pointsDelta: newPoints - oldPoints,
      streakMinPoints: challenge.streakMinPoints,
      now,
      // When type changed: new category gets +newPoints; when same: apply delta
      categoryId: typeChanged ? undefined : activityType.categoryId,
      metricDelta: metricDeltaForCommonPath,
      // Skip weekly in common path when a full swap is needed (handled explicitly).
      loggedDate: weeklyNeedsSwap ? undefined : newLoggedDateTs,
      challengeStartDate: weeklyNeedsSwap ? undefined : challenge.startDate,
    });
    // When type changed, apply the full new points to the new category
    if (typeChanged) {
      await applyCategoryPointsDelta(ctx, {
        userId: user._id,
        challengeId: activity.challengeId,
        categoryId: activityType.categoryId,
        pointsDelta: newPoints,
        metricDelta: newMetricValue,
        now,
      });
    }
    if (weeklyNeedsSwap) {
      await applyWeeklyCategoryPointsDeltaFromDate(ctx, {
        userId: user._id,
        challengeId: activity.challengeId,
        categoryId: activityType.categoryId,
        loggedDate: newLoggedDateTs,
        challengeStartDate: challenge.startDate,
        pointsDelta: newPoints,
        metricDelta: newMetricValue,
        now,
      });
    }

    // Sync activity tags if taggedUserIds was provided
    if (args.taggedUserIds !== undefined) {
      // Get existing tags
      const existingTags = await ctx.db
        .query("activityTags")
        .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
        .collect();
      const existingTaggedIds = new Set(existingTags.map((t) => t.taggedUserId as string));
      const newTaggedIds = new Set(args.taggedUserIds.map((id) => id as string));

      // Remove tags that are no longer in the list
      for (const tag of existingTags) {
        if (!newTaggedIds.has(tag.taggedUserId as string)) {
          await ctx.db.delete(tag._id);
        }
      }

      // Add new tags (createActivityTags handles dedup, validation, notifications)
      const toAdd = args.taggedUserIds.filter((id) => !existingTaggedIds.has(id as string));
      if (toAdd.length > 0) {
        await createActivityTags(ctx, {
          activityId: args.activityId,
          taggerUserId: user._id,
          challengeId: activity.challengeId,
          taggedUserIds: toAdd,
          loggedDate: newLoggedDateTs,
        });
      }
    }

    // Re-run achievement check
    await checkAndAwardAchievements(ctx, user._id, activity.challengeId, args.activityId);

      return { success: true, pointsEarned: newPoints };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.activities.editActivity",
        startedAt,
        challengeId: resolvedChallengeId,
        userId: resolvedUserId,
      });
    }
  },
});

// Soft delete an activity (for cleanup/admin purposes)
export const remove = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedChallengeId: string | undefined;
    let resolvedUserId: string | undefined;
    try {
      const actor = await requireCurrentUser(ctx);
      const activity = await ctx.db.get(args.activityId);
      if (!activity) {
        throw new Error("Activity not found");
      }
      resolvedChallengeId = String(activity.challengeId);
      resolvedUserId = String(activity.userId);
      if (activity.deletedAt) {
        return { deleted: true };
      }

    const challenge = await ctx.db.get(activity.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const canDelete =
      actor.role === "admin" ||
      challenge.creatorId === actor._id ||
      activity.userId === actor._id;
    if (!canDelete) {
      throw new ConvexError("You don't have permission to delete this activity.");
    }

      return await softDeleteActivityWithLifecycle(ctx, {
        activityId: args.activityId,
        deletedById: actor?._id,
        deletedReason: "manual",
      });
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.activities.remove",
        startedAt,
        challengeId: resolvedChallengeId,
        userId: resolvedUserId,
      });
    }
  },
});
