import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { calculateActivityPoints, calculateThresholdBonuses, calculateOptionalBonuses } from "../lib/scoring";
import { getCurrentUser } from "../lib/ids";
import { isPaymentRequired } from "../lib/payments";
import type { Id } from "../_generated/dataModel";

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
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Validate participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
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
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Validate activity type
    const activityType = await ctx.db.get(args.activityTypeId);
    if (!activityType || activityType.challengeId !== args.challengeId) {
      throw new Error("Activity type not found or does not belong to this challenge");
    }

    // Parse logged date for validation
    const loggedDateTs = Date.parse(args.loggedDate);

    // Enforce validWeeks restriction
    if (activityType.validWeeks && activityType.validWeeks.length > 0) {
      const weekNumber = getChallengeWeekNumber(challenge.startDate, loggedDateTs);
      if (!activityType.validWeeks.includes(weekNumber)) {
        throw new Error(
          `This activity type is only available during week(s) ${activityType.validWeeks.join(", ")}. ` +
          `Current week: ${weekNumber}`
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
            q.eq(q.field("activityTypeId"), args.activityTypeId)
          )
        )
        .collect();

      if (existingCount.length >= activityType.maxPerChallenge) {
        throw new Error(
          `You have already logged this activity ${existingCount.length} time(s). ` +
          `Maximum allowed: ${activityType.maxPerChallenge}`
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

    const totalBonusPoints = thresholdBonusPoints + optionalBonusPoints;
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
    ];

    const pointsEarned = basePoints + totalBonusPoints;

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
  },
});

/**
 * Check if user has earned any achievements and award them
 */
async function checkAndAwardAchievements(
  ctx: any,
  userId: any,
  challengeId: any,
  triggeringActivityId: any
) {
  // Get all achievements for this challenge
  const achievements = await ctx.db
    .query("achievements")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  if (achievements.length === 0) return;

  for (const achievement of achievements) {
    // Check if already earned (for once_per_challenge)
    if (achievement.frequency === "once_per_challenge") {
      const existing = await ctx.db
        .query("userAchievements")
        .withIndex("userAchievement", (q: any) =>
          q.eq("userId", userId).eq("achievementId", achievement._id)
        )
        .first();

      if (existing) continue;
    }

    // For once_per_week, check if earned this week
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

    // Get qualifying activities
    const qualifyingActivities = await getQualifyingActivities(
      ctx,
      userId,
      challengeId,
      achievement.criteria
    );

    // Check if threshold met
    if (qualifyingActivities.length >= achievement.criteria.requiredCount) {
      // Award the achievement
      const qualifyingIds = qualifyingActivities
        .slice(0, achievement.criteria.requiredCount)
        .map((a: any) => a._id);

      // Create a bonus activity for the achievement points
      const bonusActivityType = await getOrCreateAchievementBonusType(ctx, challengeId);

      const bonusActivityId = await ctx.db.insert("activities", {
        userId,
        challengeId,
        activityTypeId: bonusActivityType._id,
        loggedDate: Date.now(),
        metrics: { achievementId: achievement._id, achievementName: achievement.name },
        notes: `Achievement earned: ${achievement.name}`,
        source: "manual",
        pointsEarned: achievement.bonusPoints,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Record the user achievement
      await ctx.db.insert("userAchievements", {
        challengeId,
        userId,
        achievementId: achievement._id,
        earnedAt: Date.now(),
        qualifyingActivityIds: qualifyingIds,
        bonusActivityId,
      });

      // Update user's total points
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
}

// Map achievement metric names to activity metric keys
const ACHIEVEMENT_METRIC_KEYS: Record<string, string[]> = {
  distance_miles: ["miles", "distance_miles", "distance"],
  distance_km: ["kilometers", "km", "distance_km", "distance"],
  duration_minutes: ["minutes", "duration_minutes", "duration"],
};

/**
 * Get the metric value from activity metrics using various possible keys
 */
function getMetricValue(metrics: Record<string, unknown>, metricName: string): number {
  const possibleKeys = ACHIEVEMENT_METRIC_KEYS[metricName] || [metricName];

  for (const key of possibleKeys) {
    const value = Number(metrics[key]);
    if (value > 0) {
      return value;
    }
  }

  return 0;
}

/**
 * Get activities that qualify for an achievement
 */
async function getQualifyingActivities(
  ctx: any,
  userId: any,
  challengeId: any,
  criteria: {
    activityTypeIds: any[];
    metric: string;
    threshold: number;
    requiredCount: number;
  }
) {
  const allActivities = await ctx.db
    .query("activities")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("challengeId"), challengeId))
    .collect();

  return allActivities.filter((activity: any) => {
    // Check if activity type matches
    if (!criteria.activityTypeIds.includes(activity.activityTypeId)) {
      return false;
    }

    // Check if metric meets threshold
    const metrics = activity.metrics ?? {};
    const metricValue = getMetricValue(metrics, criteria.metric);

    return metricValue >= criteria.threshold;
  });
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

/**
 * Get the week number of the challenge for a given date
 * Week 1 = days 1-7, Week 2 = days 8-14, etc.
 * Returns 0 if the date is before the challenge starts
 */
function getChallengeWeekNumber(challengeStartDate: number, loggedDate: number): number {
  // Normalize both to start of day UTC
  const startDate = new Date(challengeStartDate);
  const loggedDateObj = new Date(loggedDate);

  const startDayUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );

  const loggedDayUtc = Date.UTC(
    loggedDateObj.getUTCFullYear(),
    loggedDateObj.getUTCMonth(),
    loggedDateObj.getUTCDate()
  );

  // Calculate days since challenge start (0-indexed)
  const daysSinceStart = Math.floor((loggedDayUtc - startDayUtc) / (1000 * 60 * 60 * 24));

  if (daysSinceStart < 0) {
    return 0; // Before challenge started
  }

  // Week 1 = days 0-6, Week 2 = days 7-13, etc.
  return Math.floor(daysSinceStart / 7) + 1;
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

// Delete an activity (for cleanup/admin purposes)
export const remove = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      throw new Error("Activity not found");
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

    // Delete related likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .collect();
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    // Delete related comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the activity
    await ctx.db.delete(args.activityId);

    return { deleted: true };
  },
});
