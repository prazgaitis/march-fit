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
import {
  calculateActivityPoints,
  calculateThresholdBonuses,
  calculateOptionalBonuses,
  calculateMediaBonus,
} from "../lib/scoring";
import { isPaymentRequired } from "../lib/payments";
import { dateOnlyToUtcMs, coerceDateOnlyToString, formatDateOnlyFromUtcMs } from "../lib/dateOnly";
import { getChallengeWeekNumber } from "../lib/weeks";
import { notDeleted } from "../lib/activityFilters";

const DAY_MS = 24 * 60 * 60 * 1000;

const getDateOnlyTs = (ts: number) => {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

async function recomputeStreakForUserChallenge(
  ctx: any,
  userId: any,
  challengeId: any,
  streakMinPoints: number
) {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .filter(notDeleted)
    .collect();

  if (activities.length === 0) {
    return { currentStreak: 0, lastStreakDayTs: undefined };
  }

  const activityTypeIds = Array.from(new Set(activities.map((a: any) => a.activityTypeId))) as Id<"activityTypes">[];
  const activityTypes = await Promise.all(activityTypeIds.map((id) => ctx.db.get(id)));
  const contributesMap = new Map<Id<"activityTypes">, boolean>();
  for (let i = 0; i < activityTypeIds.length; i++) {
    const at = activityTypes[i];
    if (at) contributesMap.set(activityTypeIds[i], at.contributesToStreak);
  }

  const dailyPoints = new Map<number, number>();
  for (const act of activities) {
    const contributes = contributesMap.get(act.activityTypeId as Id<"activityTypes">) ?? false;
    if (!contributes) continue;
    const dayTs = getDateOnlyTs(act.loggedDate);
    dailyPoints.set(dayTs, (dailyPoints.get(dayTs) ?? 0) + act.pointsEarned);
  }

  const thresholdDays = Array.from(dailyPoints.entries())
    .filter(([, points]) => points >= streakMinPoints)
    .map(([dayTs]) => dayTs)
    .sort((a, b) => a - b);

  if (thresholdDays.length === 0) {
    return { currentStreak: 0, lastStreakDayTs: undefined };
  }

  let currentStreak = 1;
  let lastStreakDayTs = thresholdDays[0];

  for (let i = 1; i < thresholdDays.length; i++) {
    const dayTs = thresholdDays[i];
    const diffDays = Math.floor((dayTs - lastStreakDayTs) / DAY_MS);
    if (diffDays === 1) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    lastStreakDayTs = dayTs;
  }

  return { currentStreak, lastStreakDayTs };
}

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
    const basePoints = await calculateActivityPoints(activityType, {
      ctx,
      metrics: metricsObj,
      userId: args.userId,
      challengeId: args.challengeId,
      loggedDate: new Date(loggedDateTs),
    });

    const { totalBonusPoints: thresholdBonusPoints, triggeredBonuses: thresholdTriggered } =
      calculateThresholdBonuses(activityType, metricsObj);

    const selectedOptionalBonuses = metricsObj["selectedBonuses"] as string[] | undefined;
    const { totalBonusPoints: optionalBonusPoints, triggeredBonuses: optionalTriggered } =
      calculateOptionalBonuses(activityType, selectedOptionalBonuses);

    const { totalBonusPoints: mediaBonusPoints, triggeredBonus: mediaTriggered } =
      calculateMediaBonus(false); // No media via API for now

    const totalBonusPoints = thresholdBonusPoints + optionalBonusPoints + mediaBonusPoints;
    const triggeredBonuses = [
      ...thresholdTriggered,
      ...optionalTriggered.map((b) => ({
        metric: "optional",
        threshold: 0,
        bonusPoints: b.bonusPoints,
        description: b.description || b.name,
      })),
      ...(mediaTriggered ? [mediaTriggered] : []),
    ];

    const pointsEarned = basePoints + totalBonusPoints;

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

    // Streak calculation
    const loggedDateObj = new Date(loggedDateTs);
    const startOfDayUtc = Date.UTC(
      loggedDateObj.getUTCFullYear(),
      loggedDateObj.getUTCMonth(),
      loggedDateObj.getUTCDate()
    );
    const endOfDayUtc = startOfDayUtc + DAY_MS;

    const dailyActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_challenge_date", (q) =>
        q
          .eq("userId", args.userId)
          .eq("challengeId", args.challengeId)
          .gte("loggedDate", startOfDayUtc)
          .lt("loggedDate", endOfDayUtc)
      )
      .filter(notDeleted)
      .collect();

    const activityTypeIds = new Set(dailyActivities.map((a) => a.activityTypeId));
    const activityTypesMap = new Map<string, boolean>();

    for (const id of activityTypeIds) {
      if (id === args.activityTypeId) {
        activityTypesMap.set(id, activityType.contributesToStreak);
      } else {
        const at = await ctx.db.get(id);
        if (at) activityTypesMap.set(id, at.contributesToStreak);
      }
    }

    const dailyPoints = dailyActivities.reduce((sum, act) => {
      const contributes = activityTypesMap.get(act.activityTypeId) ?? false;
      return contributes ? sum + act.pointsEarned : sum;
    }, 0);

    const meetsThreshold = dailyPoints >= challenge.streakMinPoints;

    let currentStreak = participation.currentStreak;
    let lastStreakDayTs = participation.lastStreakDay;
    const loggedDayTs = getDateOnlyTs(loggedDateTs);

    if (!lastStreakDayTs) {
      if (meetsThreshold) {
        currentStreak = 1;
        lastStreakDayTs = loggedDayTs;
      }
    } else {
      const lastDayTs = getDateOnlyTs(lastStreakDayTs);
      const diffMs = loggedDayTs - lastDayTs;
      const daysDiff = Math.floor(diffMs / DAY_MS);

      if (meetsThreshold) {
        if (lastDayTs === loggedDayTs) {
          // Already counted
        } else if (daysDiff === 1) {
          currentStreak += 1;
          lastStreakDayTs = loggedDayTs;
        } else if (daysDiff > 1) {
          currentStreak = 1;
          lastStreakDayTs = loggedDayTs;
        } else if (daysDiff < 0) {
          const recomputed = await recomputeStreakForUserChallenge(
            ctx,
            args.userId,
            args.challengeId,
            challenge.streakMinPoints
          );
          currentStreak = recomputed.currentStreak;
          lastStreakDayTs = recomputed.lastStreakDayTs;
        }
      }
    }

    await ctx.db.patch(participation._id, {
      totalPoints: participation.totalPoints + pointsEarned,
      currentStreak,
      lastStreakDay: lastStreakDayTs,
      updatedAt: Date.now(),
    });

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
    const actor = await ctx.db.get(args.userId);
    if (!actor) throw new Error("User not found");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");
    if (activity.deletedAt) return { deleted: true };

    const challenge = await ctx.db.get(activity.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const canDelete =
      actor.role === "admin" ||
      challenge.creatorId === actor._id ||
      activity.userId === actor._id;
    if (!canDelete) {
      throw new Error("Not authorized to delete activity");
    }

    // Update participation points
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", activity.userId).eq("challengeId", activity.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        totalPoints: Math.max(0, participation.totalPoints - activity.pointsEarned),
        updatedAt: Date.now(),
      });
    }

    const now = Date.now();
    await ctx.db.patch(args.activityId, {
      deletedAt: now,
      deletedById: actor._id,
      deletedReason: "manual",
      updatedAt: now,
    });

    return { deleted: true };
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
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) throw new Error("Activity not found");

    const now = Date.now();
    const updates: Record<string, unknown> = { updatedAt: now };
    const changes: Record<string, unknown> = {};

    if (args.activityTypeId !== undefined) {
      const newType = await ctx.db.get(args.activityTypeId);
      if (!newType || newType.challengeId !== activity.challengeId) {
        throw new Error("Activity type not found or does not belong to this challenge");
      }
      updates.activityTypeId = args.activityTypeId;
      changes.activityTypeId = { from: activity.activityTypeId, to: args.activityTypeId };
    }

    if (args.pointsEarned !== undefined) {
      const pointsDiff = args.pointsEarned - activity.pointsEarned;
      updates.pointsEarned = args.pointsEarned;
      changes.pointsEarned = { from: activity.pointsEarned, to: args.pointsEarned };

      if (pointsDiff !== 0) {
        const participation = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", activity.userId).eq("challengeId", activity.challengeId)
          )
          .first();

        if (participation) {
          await ctx.db.patch(participation._id, {
            totalPoints: participation.totalPoints + pointsDiff,
            updatedAt: now,
          });
        }
      }
    }

    if (args.notes !== undefined) {
      updates.notes = args.notes;
      changes.notes = { from: activity.notes, to: args.notes };
    }

    if (args.loggedDate !== undefined) {
      updates.loggedDate = Date.parse(args.loggedDate);
      changes.loggedDate = { from: activity.loggedDate, to: updates.loggedDate };
    }

    if (args.metrics !== undefined) {
      updates.metrics = args.metrics;
      changes.metrics = { from: activity.metrics, to: args.metrics };
    }

    await ctx.db.patch(args.activityId, updates);

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
  },
});
