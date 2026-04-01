import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { notDeleted } from "./activityFilters";
import {
  coerceDateOnlyToString,
  dateOnlyToUtcMs,
  formatDateOnlyFromUtcMs,
  normalizeDateOnlyInput,
} from "./dateOnly";
import { getChallengeWeekNumber } from "./weeks";
import { isPaymentRequired } from "./payments";
import {
  calculateFinalActivityScore,
  extractActivityMetricValue,
} from "./scoring";
import { computeCriteriaProgress } from "./achievements";
import { insertActivity, patchActivity } from "./activityWrites";
import { applyParticipationScoreDeltaAndRecomputeStreak } from "./participationScoring";
import { insertNotification } from "./notifications";

type LogActivityWithLifecycleArgs = {
  userId: Id<"users">;
  challengeId: Id<"challenges">;
  activityTypeId: Id<"activityTypes">;
  loggedDate: string;
  metrics?: any;
  notes?: string;
  imageUrl?: string;
  mediaIds?: Id<"_storage">[];
  cloudinaryPublicIds?: string[];
  localTime?: string;
  timezone?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  startLatlng?: number[];
  source: "manual" | "strava" | "apple_health";
  externalId?: string;
  externalData?: any;
  taggedUserIds?: Id<"users">[];
  pointsOverride?: number;
};

export async function logActivityWithLifecycle(
  ctx: any,
  args: LogActivityWithLifecycleArgs,
) {
  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", args.userId).eq("challengeId", args.challengeId),
    )
    .first();

  if (!participation) {
    throw new ConvexError("You are not part of this challenge.");
  }

  const paymentConfig = await ctx.db
    .query("challengePaymentConfig")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", args.challengeId))
    .first();

  if (
    isPaymentRequired(paymentConfig) &&
    participation.paymentStatus !== "paid"
  ) {
    throw new ConvexError("Please complete payment before logging activities.");
  }

  const challenge = await ctx.db.get(args.challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  const activityType = await ctx.db.get(args.activityTypeId);
  if (!activityType || activityType.challengeId !== args.challengeId) {
    throw new ConvexError("This activity type is not available for this challenge.");
  }

  const loggedDateTs = dateOnlyToUtcMs(normalizeDateOnlyInput(args.loggedDate));

  const challengeStartStr = coerceDateOnlyToString(challenge.startDate);
  const loggedDateStr = formatDateOnlyFromUtcMs(loggedDateTs);
  if (loggedDateStr < challengeStartStr) {
    throw new ConvexError(
      `This date is before the challenge start date (${challengeStartStr}).`,
    );
  }

  if (activityType.validWeeks && activityType.validWeeks.length > 0) {
    const weekNumber = getChallengeWeekNumber(challenge.startDate, loggedDateTs);
    if (!activityType.validWeeks.includes(weekNumber)) {
      const weekLabel =
        activityType.validWeeks.length === 1
          ? `week ${activityType.validWeeks[0]}`
          : `weeks ${activityType.validWeeks.join(", ")}`;
      throw new ConvexError(
        `"${activityType.name}" is only available during ${weekLabel}. You're currently in week ${weekNumber}.`,
      );
    }
  }

  if (
    activityType.maxPerChallenge !== undefined &&
    activityType.maxPerChallenge > 0
  ) {
    const existingCount = await ctx.db
      .query("activities")
      .withIndex("userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("challengeId"), args.challengeId),
          q.eq(q.field("activityTypeId"), args.activityTypeId),
          notDeleted(q),
        ),
      )
      .collect();

    if (existingCount.length >= activityType.maxPerChallenge) {
      throw new ConvexError(
        activityType.maxPerChallenge === 1
          ? `You've already logged "${activityType.name}". It can only be logged once.`
          : `You've reached the limit of ${activityType.maxPerChallenge} for "${activityType.name}".`,
      );
    }
  }

  const metricsObj = args.metrics ?? {};

  let basePoints: number;
  let totalBonusPoints: number;
  let pointsEarned: number;
  let triggeredBonuses: Awaited<
    ReturnType<typeof calculateFinalActivityScore>
  >["triggeredBonuses"] = [];

  if (args.pointsOverride !== undefined) {
    basePoints = args.pointsOverride;
    totalBonusPoints = 0;
    pointsEarned = args.pointsOverride;
  } else {
    const selectedOptionalBonuses = metricsObj["selectedBonuses"] as
      | string[]
      | undefined;

    const hasMedia =
      !!((args.mediaIds && args.mediaIds.length > 0) ||
        (args.cloudinaryPublicIds && args.cloudinaryPublicIds.length > 0) ||
        args.imageUrl);

    let alreadyEarnedPhotoBonus = false;
    if (hasMedia) {
      const existingActivitiesToday = await ctx.db
        .query("activities")
        .withIndex("userId", (q: any) => q.eq("userId", args.userId))
        .filter((q: any) =>
          q.and(q.eq(q.field("challengeId"), args.challengeId), notDeleted(q)),
        )
        .collect();

      alreadyEarnedPhotoBonus = existingActivitiesToday.some((activity: any) => {
        const activityDateStr = formatDateOnlyFromUtcMs(activity.loggedDate);
        const activityHasMedia =
          !!(activity.mediaIds && activity.mediaIds.length > 0) ||
          !!(activity.cloudinaryPublicIds && activity.cloudinaryPublicIds.length > 0) ||
          !!activity.imageUrl;
        const activityHasPhotoBonus = !!activity.triggeredBonuses?.some(
          (bonus: any) => bonus.metric === "media",
        );
        return (
          activityDateStr === loggedDateStr &&
          activityHasMedia &&
          activityHasPhotoBonus
        );
      });
    }

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
        includeMediaBonus: hasMedia && !alreadyEarnedPhotoBonus,
      },
    );

    basePoints = score.basePoints;
    totalBonusPoints = score.bonusPoints;
    pointsEarned = score.pointsEarned;
    triggeredBonuses = score.triggeredBonuses;
  }

  const now = Date.now();
  const activityId = await insertActivity(ctx, {
    userId: args.userId,
    challengeId: args.challengeId,
    activityTypeId: args.activityTypeId,
    loggedDate: loggedDateTs,
    metrics: metricsObj,
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
    pointsEarned,
    triggeredBonuses:
      triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
    flagged: false,
    adminCommentVisibility: "internal",
    resolutionStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const metricValue = extractActivityMetricValue(activityType, metricsObj);
  const streakUpdate = await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
    userId: args.userId,
    challengeId: args.challengeId,
    pointsDelta: pointsEarned,
    streakMinPoints: challenge.streakMinPoints,
    categoryId: activityType.categoryId,
    metricDelta: metricValue,
    loggedDate: loggedDateTs,
    challengeStartDate: challenge.startDate,
  });
  const currentStreak = streakUpdate?.currentStreak ?? participation.currentStreak;

  await checkAndAwardAchievements(ctx, args.userId, args.challengeId, activityId);
  await notifyMiniGameParticipants(ctx, args.userId, args.challengeId, activityId);

  if (args.taggedUserIds && args.taggedUserIds.length > 0) {
    await createActivityTags(ctx, {
      activityId,
      taggerUserId: args.userId,
      challengeId: args.challengeId,
      taggedUserIds: args.taggedUserIds,
      loggedDate: loggedDateTs,
    });
  }

  return {
    id: activityId,
    pointsEarned,
    basePoints,
    bonusPoints: totalBonusPoints,
    triggeredBonuses: triggeredBonuses.map((bonus) => bonus.description),
    streakUpdate: {
      currentStreak,
      days: participation.currentStreak !== currentStreak ? 1 : 0,
    },
  };
}

export async function softDeleteActivityWithLifecycle(
  ctx: any,
  args: {
    activityId: Id<"activities">;
    deletedById?: Id<"users">;
    deletedReason: string;
    now?: number;
  },
) {
  const activity = await ctx.db.get(args.activityId);
  if (!activity) {
    throw new Error("Activity not found");
  }
  if (activity.deletedAt) {
    return { deleted: true, activity };
  }

  const challenge = await ctx.db.get(activity.challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  const now = args.now ?? Date.now();
  await patchActivity(ctx, args.activityId, {
    deletedAt: now,
    deletedById: args.deletedById,
    deletedReason: args.deletedReason,
    updatedAt: now,
  });

  const deletedActivityType = await ctx.db.get(activity.activityTypeId);
  const deletedMetricValue = deletedActivityType
    ? extractActivityMetricValue(
        deletedActivityType,
        (activity.metrics ?? {}) as Record<string, unknown>,
      )
    : 0;

  await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
    userId: activity.userId,
    challengeId: activity.challengeId,
    pointsDelta: -activity.pointsEarned,
    streakMinPoints: challenge.streakMinPoints,
    now,
    categoryId: deletedActivityType?.categoryId,
    metricDelta: -deletedMetricValue,
    loggedDate: activity.loggedDate,
    challengeStartDate: challenge.startDate,
  });

  return { deleted: true, activity, challenge };
}

async function notifyMiniGameParticipants(
  ctx: any,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  activityId: Id<"activities">,
) {
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

    const participation = await ctx.db
      .query("miniGameParticipants")
      .withIndex("miniGameUser", (q: any) =>
        q.eq("miniGameId", game._id).eq("userId", userId),
      )
      .first();

    if (!participation) continue;

    if (game.type === "partner_week" && participation.partnerUserId) {
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
      if (participation.preyUserId) {
        await insertNotification(ctx, {
          userId: participation.preyUserId,
          actorId: userId,
          type: "mini_game_hunter_activity",
          data: { activityId, miniGameId: game._id, miniGameName: game.name },
          createdAt: now,
        });
      }
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
    (id) => id !== args.taggerUserId,
  );

  for (const taggedUserId of uniqueTaggedIds) {
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", taggedUserId).eq("challengeId", args.challengeId),
      )
      .first();
    if (!participation) continue;

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

  if (uniqueTaggedIds.length > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.mutations.activityTags.linkRelatedActivities,
      {
        activityId: args.activityId,
        challengeId: args.challengeId,
        loggedDate: args.loggedDate,
      },
    );
  }
}

export async function checkAndAwardAchievements(
  ctx: any,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  _triggeringActivityId: Id<"activities">,
) {
  const achievements = await ctx.db
    .query("achievements")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  if (achievements.length === 0) return;

  const allActivities = await ctx.db
    .query("activities")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .filter((q: any) =>
      q.and(q.eq(q.field("challengeId"), challengeId), notDeleted(q)),
    )
    .collect();

  // Check if any achievement uses streak criteria — if so, fetch participation once
  const hasStreakCriteria = achievements.some(
    (a: any) => a.criteria.criteriaType === "streak",
  );
  let streakContext: { currentStreak?: number } = {};
  if (hasStreakCriteria) {
    const p = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", userId).eq("challengeId", challengeId),
      )
      .first();
    streakContext = { currentStreak: p?.currentStreak };
  }

  for (const achievement of achievements) {
    if (achievement.frequency === "once_per_challenge") {
      const existing = await ctx.db
        .query("userAchievements")
        .withIndex("userAchievement", (q: any) =>
          q.eq("userId", userId).eq("achievementId", achievement._id),
        )
        .first();
      if (existing) continue;
    }

    if (achievement.frequency === "once_per_week") {
      const weekStart = getWeekStart(Date.now());
      const existing = await ctx.db
        .query("userAchievements")
        .withIndex("userAchievement", (q: any) =>
          q.eq("userId", userId).eq("achievementId", achievement._id),
        )
        .filter((q: any) => q.gte(q.field("earnedAt"), weekStart))
        .first();
      if (existing) continue;
    }

    const { currentCount, requiredCount, qualifyingActivityIds } =
      computeCriteriaProgress(allActivities, achievement.criteria, streakContext);

    if (currentCount < requiredCount) continue;

    const bonusActivityType = await getOrCreateAchievementBonusType(
      ctx,
      challengeId,
    );

    const bonusActivityId = await insertActivity(ctx, {
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

    // Auto-award any badges linked to this achievement
    const linkedBadges = await ctx.db
      .query("badges")
      .withIndex("achievementId", (q: any) =>
        q.eq("achievementId", achievement._id),
      )
      .collect();

    for (const badge of linkedBadges) {
      const existingUserBadge = await ctx.db
        .query("userBadges")
        .withIndex("userBadge", (q: any) =>
          q.eq("userId", userId).eq("badgeId", badge._id),
        )
        .first();
      if (!existingUserBadge) {
        await ctx.db.insert("userBadges", {
          challengeId,
          userId,
          badgeId: badge._id,
          awardedAt: Date.now(),
        });
      }
    }

    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", userId).eq("challengeId", challengeId),
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

async function getOrCreateAchievementBonusType(
  ctx: any,
  challengeId: Id<"challenges">,
) {
  const existing = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .filter((q: any) => q.eq(q.field("name"), "Achievement Bonus"))
    .first();

  if (existing) return existing;

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

function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff);
}
