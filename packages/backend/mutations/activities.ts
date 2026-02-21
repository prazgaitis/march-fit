import { internalMutation, mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { calculateActivityPoints, calculateThresholdBonuses, calculateOptionalBonuses, calculateMediaBonus } from "../lib/scoring";
import { getCurrentUser } from "../lib/ids";
import { isPaymentRequired } from "../lib/payments";
import type { Id } from "../_generated/dataModel";
import { dateOnlyToUtcMs, coerceDateOnlyToString, formatDateOnlyFromUtcMs } from "../lib/dateOnly";
import { getChallengeWeekNumber, isInFinalDays } from "../lib/weeks";
import { notDeleted } from "../lib/activityFilters";
import { computeCriteriaProgress } from "../lib/achievements";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";

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
    return await ctx.db.insert("activities", {
      ...args,
      adminCommentVisibility: "internal",
      resolutionStatus: "pending",
    });
  },
});

export const log = mutation({
  args: {
    challengeId: v.id("challenges"),
    activityTypeId: v.id("activityTypes"),
    loggedDate: v.string(), // ISO string
    metrics: v.optional(v.any()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    mediaIds: v.optional(v.array(v.id("_storage"))),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("apple_health")
    ),
    externalId: v.optional(v.string()),
    externalData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedUserId: string | undefined;
    try {
      const user = await getCurrentUser(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }
      resolvedUserId = String(user._id);

      // Validate participation
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", args.challengeId)
        )
        .first();

    if (!participation) {
      throw new ConvexError("You are not part of this challenge.");
    }

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (isPaymentRequired(paymentConfig) && participation.paymentStatus !== "paid") {
      throw new ConvexError("Please complete payment before logging activities.");
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Validate activity type
    const activityType = await ctx.db.get(args.activityTypeId);
    if (!activityType || activityType.challengeId !== args.challengeId) {
      throw new ConvexError("This activity type is not available for this challenge.");
    }

    // Parse logged date for validation
    const loggedDateTs = Date.parse(args.loggedDate);

    // Prevent logging activities before the challenge start date (date-only comparison)
    const challengeStartStr = coerceDateOnlyToString(challenge.startDate);
    const loggedDateStr = formatDateOnlyFromUtcMs(loggedDateTs);
    if (loggedDateStr < challengeStartStr) {
      throw new ConvexError(
        `This date is before the challenge start date (${challengeStartStr}).`
      );
    }

    // Enforce validWeeks restriction
    if (activityType.validWeeks && activityType.validWeeks.length > 0) {
      const weekNumber = getChallengeWeekNumber(challenge.startDate, loggedDateTs);
      const inValidWeek = activityType.validWeeks.includes(weekNumber);
      const inFinalDays = activityType.availableInFinalDays && isInFinalDays(challenge, loggedDateTs);
      if (!inValidWeek && !inFinalDays) {
        const weekLabel = activityType.validWeeks.length === 1
          ? `week ${activityType.validWeeks[0]}`
          : `weeks ${activityType.validWeeks.join(", ")}`;
        throw new ConvexError(
          `"${activityType.name}" is only available during ${weekLabel}. You're currently in week ${weekNumber}.`
        );
      }
    }

    // Enforce maxPerChallenge restriction
    if (activityType.maxPerChallenge !== undefined && activityType.maxPerChallenge > 0) {
      const existingCount = await ctx.db
        .query("activities")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("challengeId"), args.challengeId),
            q.eq(q.field("activityTypeId"), args.activityTypeId),
            notDeleted(q)
          )
        )
        .collect();

      if (existingCount.length >= activityType.maxPerChallenge) {
        throw new ConvexError(
          activityType.maxPerChallenge === 1
            ? `You've already logged "${activityType.name}". It can only be logged once.`
            : `You've reached the limit of ${activityType.maxPerChallenge} for "${activityType.name}".`
        );
      }
    }

    // Calculate points using the full scoring system
    const metricsObj = args.metrics ?? {};

    const basePoints = await calculateActivityPoints(activityType, {
      ctx,
      metrics: metricsObj,
      userId: user._id,
      challengeId: args.challengeId,
      loggedDate: new Date(loggedDateTs),
    });

    // Calculate threshold bonuses (e.g., marathon bonus)
    const { totalBonusPoints: thresholdBonusPoints, triggeredBonuses: thresholdTriggered } = calculateThresholdBonuses(
      activityType,
      metricsObj
    );

    // Calculate optional bonuses (e.g., weighted vest bonus)
    const selectedOptionalBonuses = metricsObj["selectedBonuses"] as string[] | undefined;
    const { totalBonusPoints: optionalBonusPoints, triggeredBonuses: optionalTriggered } = calculateOptionalBonuses(
      activityType,
      selectedOptionalBonuses
    );

    // Calculate media bonus (+1 point for posting at least one photo/media)
    // Only award once per day per challenge (daily cap)
    const hasMedia = (args.mediaIds && args.mediaIds.length > 0) || !!args.imageUrl;
    let alreadyEarnedPhotoBonus = false;
    if (hasMedia) {
      const loggedDateStr = formatDateOnlyFromUtcMs(loggedDateTs);
      const existingActivitiesToday = await ctx.db
        .query("activities")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("challengeId"), args.challengeId),
            notDeleted(q)
          )
        )
        .collect();

      alreadyEarnedPhotoBonus = existingActivitiesToday.some((a) => {
        const aDateStr = formatDateOnlyFromUtcMs(a.loggedDate);
        const aHasMedia = !!(a.mediaIds && a.mediaIds.length > 0) || !!a.imageUrl;
        const aHasPhotoBonus = !!(a.triggeredBonuses?.some((b) => b.metric === "media"));
        return aDateStr === loggedDateStr && aHasMedia && aHasPhotoBonus;
      });
    }
    const { totalBonusPoints: mediaBonusPoints, triggeredBonus: mediaTriggered } = calculateMediaBonus(hasMedia && !alreadyEarnedPhotoBonus);

    const totalBonusPoints = thresholdBonusPoints + optionalBonusPoints + mediaBonusPoints;
    // Combine bonuses into a unified format for storage
    const triggeredBonuses = [
      ...thresholdTriggered,
      // Map optional bonuses to the triggeredBonuses schema format
      ...optionalTriggered.map(b => ({
        metric: "optional",
        threshold: 0,
        bonusPoints: b.bonusPoints,
        description: b.description || b.name,
      })),
      // Media bonus
      ...(mediaTriggered ? [mediaTriggered] : []),
    ];

    const rawPoints = basePoints + totalBonusPoints;
    const pointsEarned = activityType.isNegative ? -rawPoints : rawPoints;

    // Create activity
    const activityId = await ctx.db.insert("activities", {
      userId: user._id,
      challengeId: args.challengeId,
      activityTypeId: args.activityTypeId,
      loggedDate: loggedDateTs,
      metrics: args.metrics ?? {},
      notes: args.notes,
      imageUrl: args.imageUrl,
      mediaIds: args.mediaIds,
      source: args.source,
      externalId: args.externalId,
      externalData: args.externalData,
      pointsEarned: pointsEarned,
      triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
      flagged: false,
      adminCommentVisibility: "internal",
      resolutionStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // --- Streak Calculation ---
    
    // 1. Get start and end of the logged day in UTC
    const loggedDateObj = new Date(loggedDateTs);
    const startOfDayUtc = Date.UTC(
        loggedDateObj.getUTCFullYear(),
        loggedDateObj.getUTCMonth(),
        loggedDateObj.getUTCDate()
    );
    const endOfDayUtc = startOfDayUtc + 24 * 60 * 60 * 1000;

    // 2. Fetch all activities for this user/challenge/day
    const dailyActivities = await ctx.db
        .query("activities")
        .withIndex("by_user_challenge_date", (q) => 
            q.eq("userId", user._id)
             .eq("challengeId", args.challengeId)
             .gte("loggedDate", startOfDayUtc)
             .lt("loggedDate", endOfDayUtc)
        )
        .filter(notDeleted)
        .collect();

    // 3. Calculate daily total for streak-contributing activities
    // We need to fetch activity types for each activity to check contributesToStreak
    // Optimization: we know the current activityType contributes to streak or not.
    // For others, we might need to fetch.
    
    // Collect unique activityTypeIds
    const activityTypeIds = new Set(dailyActivities.map(a => a.activityTypeId));
    const activityTypesMap = new Map<string, boolean>(); // ID -> contributesToStreak

    for (const id of activityTypeIds) {
        // Optimization: avoid fetch if it's the current one
        if (id === args.activityTypeId) {
            activityTypesMap.set(id, activityType.contributesToStreak);
        } else {
            const at = await ctx.db.get(id);
            if (at) {
                activityTypesMap.set(id, at.contributesToStreak);
            }
        }
    }

    const dailyPoints = dailyActivities.reduce((sum, act) => {
        const contributes = activityTypesMap.get(act.activityTypeId) ?? false;
        return contributes ? sum + act.pointsEarned : sum;
    }, 0);

    const meetsThreshold = dailyPoints >= challenge.streakMinPoints;

    // 4. Calculate new streak and lastStreakDay
    // Logic ported from StreakService.ts
    let currentStreak = participation.currentStreak;
    let lastStreakDayTs = participation.lastStreakDay;

    const loggedDayTs = getDateOnlyTs(loggedDateTs);

    if (!lastStreakDayTs) {
        // First time
        if (meetsThreshold) {
            currentStreak = 1;
            lastStreakDayTs = loggedDayTs;
        }
    } else {
        const lastDayTs = getDateOnlyTs(lastStreakDayTs);
        const diffMs = loggedDayTs - lastDayTs;
        const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (meetsThreshold) {
            if (lastDayTs === loggedDayTs) {
                // Already counted this day
            } else if (daysDiff === 1) {
                // Consecutive
                currentStreak += 1;
                lastStreakDayTs = loggedDayTs;
            } else if (daysDiff > 1) {
                // Broken streak, restart
                currentStreak = 1;
                lastStreakDayTs = loggedDayTs;
            } else if (daysDiff < 0) {
                // Backfilling - recompute streaks from all activities
                const recomputed = await recomputeStreakForUserChallenge(
                  ctx,
                  user._id,
                  args.challengeId,
                  challenge.streakMinPoints
                );
                currentStreak = recomputed.currentStreak;
                lastStreakDayTs = recomputed.lastStreakDayTs;
            }
        }
    }

    // Update participation total points and streak
    await ctx.db.patch(participation._id, {
      totalPoints: participation.totalPoints + pointsEarned,
      currentStreak: currentStreak,
      lastStreakDay: lastStreakDayTs,
      updatedAt: Date.now(),
    });

    // Check for achievement progress
    await checkAndAwardAchievements(ctx, user._id, args.challengeId, activityId);

      return {
          id: activityId,
          pointsEarned,
          basePoints,
          bonusPoints: totalBonusPoints,
          triggeredBonuses: triggeredBonuses.map(b => b.description),
          streakUpdate: {
              currentStreak,
              days: participation.currentStreak !== currentStreak ? 1 : 0 // Just informative
          }
      };
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

/**
 * Check if user has earned any achievements and award them.
 * Handles all four criteria types: count, cumulative, distinct_types, one_of_each.
 */
async function checkAndAwardAchievements(
  ctx: any,
  userId: any,
  challengeId: any,
  _triggeringActivityId: any
) {
  const achievements = await ctx.db
    .query("achievements")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  if (achievements.length === 0) return;

  // Fetch all non-deleted activities once to avoid N+1 per achievement
  const allActivities = await ctx.db
    .query("activities")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .filter((q: any) =>
      q.and(q.eq(q.field("challengeId"), challengeId), notDeleted(q))
    )
    .collect();

  for (const achievement of achievements) {
    // Guard: skip if already earned (once_per_challenge)
    if (achievement.frequency === "once_per_challenge") {
      const existing = await ctx.db
        .query("userAchievements")
        .withIndex("userAchievement", (q: any) =>
          q.eq("userId", userId).eq("achievementId", achievement._id)
        )
        .first();
      if (existing) continue;
    }

    // Guard: skip if already earned this week (once_per_week)
    if (achievement.frequency === "once_per_week") {
      const weekStart = getWeekStart(Date.now());
      const existing = await ctx.db
        .query("userAchievements")
        .withIndex("userAchievement", (q: any) =>
          q.eq("userId", userId).eq("achievementId", achievement._id)
        )
        .filter((q: any) => q.gte(q.field("earnedAt"), weekStart))
        .first();
      if (existing) continue;
    }

    // Evaluate criteria using the shared helper
    const { currentCount, requiredCount, qualifyingActivityIds } =
      computeCriteriaProgress(allActivities, achievement.criteria);

    if (currentCount < requiredCount) continue;

    // Award the achievement
    const bonusActivityType = await getOrCreateAchievementBonusType(
      ctx,
      challengeId
    );

    const bonusActivityId = await ctx.db.insert("activities", {
      userId,
      challengeId,
      activityTypeId: bonusActivityType._id,
      loggedDate: Date.now(),
      metrics: {
        achievementId: achievement._id,
        achievementName: achievement.name,
      },
      notes: `Achievement earned: ${achievement.name}`,
      source: "manual",
      pointsEarned: achievement.bonusPoints,
      flagged: false,
      adminCommentVisibility: "internal",
      resolutionStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("userAchievements", {
      challengeId,
      userId,
      achievementId: achievement._id,
      earnedAt: Date.now(),
      qualifyingActivityIds,
      bonusActivityId,
    });

    // Credit bonus points to participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", userId).eq("challengeId", challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        totalPoints: participation.totalPoints + achievement.bonusPoints,
        updatedAt: Date.now(),
      });
    }
  }
}

/**
 * Get or create the achievement bonus activity type
 */
async function getOrCreateAchievementBonusType(ctx: any, challengeId: any) {
  // Look for existing achievement bonus type
  const existing = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .filter((q: any) => q.eq(q.field("name"), "Achievement Bonus"))
    .first();

  if (existing) return existing;

  // Create a new one
  const id = await ctx.db.insert("activityTypes", {
    challengeId,
    name: "Achievement Bonus",
    description: "Bonus points from earning achievements",
    scoringConfig: { basePoints: 0 },
    contributesToStreak: false,
    isNegative: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return await ctx.db.get(id);
}

/**
 * Get the start of the current week (Sunday)
 */
function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff);
}


// Generate an upload URL for activity media
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
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
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

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
      await ctx.db.patch(args.activityId, {
        flagged: true,
        flaggedAt: now,
        flaggedReason: args.reason,
        resolutionStatus: "pending",
        updatedAt: now,
      });
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
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    let resolvedChallengeId: string | undefined;
    let resolvedUserId: string | undefined;
    try {
      const user = await getCurrentUser(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }
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
      ? dateOnlyToUtcMs(args.loggedDate)
      : activity.loggedDate;

    // Determine new metrics
    const newMetrics = args.metrics !== undefined ? args.metrics : (activity.metrics ?? {});

    // Recalculate points using the same scoring logic as `log`
    const metricsObj = newMetrics ?? {};

    const basePoints = await calculateActivityPoints(activityType, {
      ctx,
      metrics: metricsObj,
      userId: user._id,
      challengeId: activity.challengeId,
      loggedDate: new Date(newLoggedDateTs),
    });

    const { totalBonusPoints: thresholdBonusPoints, triggeredBonuses: thresholdTriggered } =
      calculateThresholdBonuses(activityType, metricsObj);

    const selectedOptionalBonuses = (metricsObj as Record<string, unknown>)["selectedBonuses"] as string[] | undefined;
    const { totalBonusPoints: optionalBonusPoints, triggeredBonuses: optionalTriggered } =
      calculateOptionalBonuses(activityType, selectedOptionalBonuses);

    // Keep media bonus if activity already has media, but respect the 1-per-day cap.
    // Exclude this activity itself from the "already earned today" check since we're editing it.
    const hasMedia = !!(activity.mediaIds && activity.mediaIds.length > 0) || !!activity.imageUrl;
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
        const aHasMedia = !!(a.mediaIds && a.mediaIds.length > 0) || !!a.imageUrl;
        const aHasPhotoBonus = !!(a.triggeredBonuses?.some((b) => b.metric === "media"));
        return aDateStr === loggedDateStrEdit && aHasMedia && aHasPhotoBonus;
      });
    }
    const { totalBonusPoints: mediaBonusPoints, triggeredBonus: mediaTriggered } =
      calculateMediaBonus(hasMedia && !alreadyEarnedPhotoBonusEdit);

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

    const rawNewPoints = basePoints + totalBonusPoints;
    const newPoints = activityType.isNegative ? -rawNewPoints : rawNewPoints;
    const oldPoints = activity.pointsEarned;

    // Update participation totalPoints
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", activity.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        totalPoints: Math.max(0, participation.totalPoints - oldPoints + newPoints),
        updatedAt: Date.now(),
      });
    }

    // Patch the activity
    const now = Date.now();
    await ctx.db.patch(args.activityId, {
      activityTypeId: newActivityTypeId,
      metrics: newMetrics,
      notes: args.notes !== undefined ? args.notes : activity.notes,
      loggedDate: newLoggedDateTs,
      pointsEarned: newPoints,
      triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
      updatedAt: now,
    });

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
      const actor = await getCurrentUser(ctx);
      if (!actor) {
        throw new Error("Not authenticated");
      }
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
      deletedById: actor?._id,
      deletedReason: "manual",
      updatedAt: now,
    });

      return { deleted: true };
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
