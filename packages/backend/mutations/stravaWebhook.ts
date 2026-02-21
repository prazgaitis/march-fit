import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import {
  detectStravaActivityType,
  mapStravaActivity,
  type StravaActivity,
} from "../lib/strava";
import { calculateFinalActivityScore } from "../lib/scoring";
import { isPaymentRequired } from "../lib/payments";
import { notDeleted } from "../lib/activityFilters";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";
import { applyParticipationScoreDeltaAndRecomputeStreak } from "../lib/participationScoring";
import { dateOnlyToUtcMs } from "../lib/dateOnly";

/**
 * Get user's active challenge participations
 */
export const getUserParticipations = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch challenge details for each participation
    const result = await Promise.all(
      participations.map(async (p) => {
        const challenge = await ctx.db.get(p.challengeId);
        return {
          participation: p,
          challenge,
        };
      })
    );

    return result.filter((r) => r.challenge !== null);
  },
});

/**
 * Check if an activity already exists for this external ID
 */
export const getExistingActivity = internalQuery({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activities")
      .withIndex("externalUnique", (q) =>
        q
          .eq("userId", args.userId)
          .eq("challengeId", args.challengeId)
          .eq("externalId", args.externalId)
      )
      .filter(notDeleted)
      .first();
  },
});

/**
 * Create an activity from a Strava webhook event
 */
export const createFromStrava = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    stravaActivity: v.any(),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    try {
      const stravaActivity = args.stravaActivity as StravaActivity;
      const challenge = await ctx.db.get(args.challengeId);
      if (!challenge) {
        return null;
      }

    const userChallenge = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();
    if (!userChallenge) {
      return null;
    }

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (isPaymentRequired(paymentConfig) && userChallenge.paymentStatus !== "paid") {
      console.log(
        `Skipping Strava activity for unpaid participation: ${args.userId} / ${args.challengeId}`
      );
      return null;
    }

    // Detect the activity type and get metric mapping config
    const detectionResult = await detectStravaActivityType(
      ctx,
      args.challengeId,
      stravaActivity
    );

    if (!detectionResult) {
      console.log(
        `No matching activity type found for Strava type: ${stravaActivity.type} / ${stravaActivity.sport_type}`
      );
      return null;
    }

    const { activityTypeId, metricMapping } = detectionResult;

    // Get the activity type details for scoring
    const activityType = await ctx.db.get(activityTypeId);
    if (!activityType) {
      console.error("Activity type not found:", activityTypeId);
      return null;
    }

    // Map the Strava activity to our format (with metric mapping if configured)
    const mappedActivity = mapStravaActivity(stravaActivity, activityTypeId, metricMapping);

    // Calculate points
    const loggedDateTs = dateOnlyToUtcMs(mappedActivity.loggedDate);
    // Calculate media bonus (+1 point for Strava activities with photos)
    const hasMedia = mappedActivity.stravaPhotoUrls.length > 0 || !!mappedActivity.imageUrl;
    const score = await calculateFinalActivityScore(
      activityType,
      {
        ctx,
        metrics: mappedActivity.metrics,
        userId: args.userId,
        challengeId: args.challengeId,
        loggedDate: new Date(loggedDateTs),
      },
      {
        includeMediaBonus: hasMedia,
      }
    );
    const pointsEarned = score.pointsEarned;
    const triggeredBonuses = score.triggeredBonuses;

    // Check for existing activity
    const existing = await ctx.db
      .query("activities")
      .withIndex("externalUnique", (q) =>
        q
          .eq("userId", args.userId)
          .eq("challengeId", args.challengeId)
          .eq("externalId", mappedActivity.externalId)
      )
      .first();

    if (existing) {
      if (existing.deletedAt) {
        await ctx.db.patch(existing._id, {
          activityTypeId,
          loggedDate: loggedDateTs,
          metrics: mappedActivity.metrics,
          pointsEarned,
          triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
          imageUrl: mappedActivity.imageUrl ?? existing.imageUrl,
          externalData: mappedActivity.externalData,
          deletedAt: undefined,
          deletedById: undefined,
          deletedReason: undefined,
          updatedAt: Date.now(),
        });

        await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
          userId: args.userId,
          challengeId: args.challengeId,
          pointsDelta: pointsEarned,
          streakMinPoints: challenge.streakMinPoints,
        });

        return existing._id;
      }

      // Update existing activity
      await ctx.db.patch(existing._id, {
        activityTypeId,
        loggedDate: loggedDateTs,
        metrics: mappedActivity.metrics,
        pointsEarned,
        triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
        imageUrl: mappedActivity.imageUrl ?? existing.imageUrl,
        externalData: mappedActivity.externalData,
        updatedAt: Date.now(),
      });

      await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
        userId: args.userId,
        challengeId: args.challengeId,
        pointsDelta: pointsEarned - existing.pointsEarned,
        streakMinPoints: challenge.streakMinPoints,
      });

      return existing._id;
    }

    // Create new activity (include Strava photo URL if available)
    const activityId = await ctx.db.insert("activities", {
      userId: args.userId,
      challengeId: args.challengeId,
      activityTypeId,
      loggedDate: loggedDateTs,
      metrics: mappedActivity.metrics,
      notes: mappedActivity.notes ?? undefined,
      imageUrl: mappedActivity.imageUrl ?? undefined,
      source: "strava",
      externalId: mappedActivity.externalId,
      externalData: mappedActivity.externalData,
      pointsEarned,
      triggeredBonuses: triggeredBonuses.length > 0 ? triggeredBonuses : undefined,
      flagged: false,
      adminCommentVisibility: "internal",
      resolutionStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
      userId: args.userId,
      challengeId: args.challengeId,
      pointsDelta: pointsEarned,
      streakMinPoints: challenge.streakMinPoints,
    });

      return activityId;
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.stravaWebhook.createFromStrava",
        startedAt,
        challengeId: String(args.challengeId),
        userId: String(args.userId),
      });
    }
  },
});

/**
 * Delete an activity from Strava (soft delete)
 */
export const deleteFromStrava = internalMutation({
  args: {
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    try {
      // Find all activities with this external ID
      const activities = await ctx.db
        .query("activities")
        .filter((q) =>
          q.and(
            q.eq(q.field("source"), "strava"),
            q.eq(q.field("externalId"), args.externalId)
          )
        )
        .collect();

    const now = Date.now();
    let deletedCount = 0;
    for (const activity of activities) {
      if (activity.deletedAt) {
        continue;
      }
      const challenge = await ctx.db.get(activity.challengeId);
      if (!challenge) {
        continue;
      }

      await ctx.db.patch(activity._id, {
        deletedAt: now,
        deletedReason: "strava_delete",
        updatedAt: now,
      });
      await applyParticipationScoreDeltaAndRecomputeStreak(ctx, {
        userId: activity.userId,
        challengeId: activity.challengeId,
        pointsDelta: -activity.pointsEarned,
        streakMinPoints: challenge.streakMinPoints,
        now,
      });
      deletedCount += 1;
    }

      return { deleted: deletedCount };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.stravaWebhook.deleteFromStrava",
        startedAt,
      });
    }
  },
});
