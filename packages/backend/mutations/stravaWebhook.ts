import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import {
  detectStravaActivityType,
  mapStravaActivity,
  type StravaActivity,
} from "../lib/strava";
import { calculateActivityPoints, calculateThresholdBonuses, calculateMediaBonus } from "../lib/scoring";
import { isPaymentRequired } from "../lib/payments";

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
    const stravaActivity = args.stravaActivity as StravaActivity;

    const userChallenge = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (isPaymentRequired(paymentConfig) && userChallenge?.paymentStatus !== "paid") {
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
    const loggedDateTs = Date.parse(mappedActivity.loggedDate);
    const basePoints = await calculateActivityPoints(activityType, {
      ctx,
      metrics: mappedActivity.metrics,
      userId: args.userId,
      challengeId: args.challengeId,
      loggedDate: new Date(loggedDateTs),
    });

    // Calculate threshold bonuses
    const { totalBonusPoints: thresholdBonusPoints, triggeredBonuses: thresholdTriggered } = calculateThresholdBonuses(
      activityType,
      mappedActivity.metrics
    );

    // Calculate media bonus (+1 point for Strava activities with photos)
    const hasMedia = mappedActivity.stravaPhotoUrls.length > 0 || !!mappedActivity.imageUrl;
    const { totalBonusPoints: mediaBonusPoints, triggeredBonus: mediaTriggered } = calculateMediaBonus(hasMedia);

    const totalBonusPoints = thresholdBonusPoints + mediaBonusPoints;
    const triggeredBonuses = [
      ...thresholdTriggered,
      ...(mediaTriggered ? [mediaTriggered] : []),
    ];

    const pointsEarned = basePoints + totalBonusPoints;

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

      // Update participation points (recalculate diff)
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", args.userId).eq("challengeId", args.challengeId)
        )
        .first();

      if (participation) {
        const pointsDiff = pointsEarned - existing.pointsEarned;
        await ctx.db.patch(participation._id, {
          totalPoints: participation.totalPoints + pointsDiff,
          updatedAt: Date.now(),
        });
      }

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

    // Update participation total points
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        totalPoints: participation.totalPoints + pointsEarned,
        updatedAt: Date.now(),
      });
    }

    return activityId;
  },
});

/**
 * Delete an activity from Strava (soft delete by removing)
 */
export const deleteFromStrava = internalMutation({
  args: {
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
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

    for (const activity of activities) {
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
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      for (const like of likes) {
        await ctx.db.delete(like._id);
      }

      // Delete related comments
      const comments = await ctx.db
        .query("comments")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }

      // Delete the activity
      await ctx.db.delete(activity._id);
    }

    return { deleted: activities.length };
  },
});
