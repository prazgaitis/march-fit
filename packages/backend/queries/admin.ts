import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { coerceDateOnlyToString, dateOnlyToUtcMs } from "../lib/dateOnly";
import { notDeleted } from "../lib/activityFilters";

/**
 * List all users (for debugging)
 */
export const listUsers = query({
  args: {
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.email) {
      // Search by email
      const users = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), args.email))
        .collect();
      return users;
    }

    // Return first 50 users
    const users = await ctx.db.query("users").take(50);
    return users;
  },
});

/**
 * Check for activities outside challenge date bounds
 */
export const checkOutOfBoundsActivities = query({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db.query("challenges").collect();
    const results: Array<{
      challengeId: string;
      challengeName: string;
      startDate: string;
      endDate: string;
      totalActivities: number;
      outOfBounds: number;
      beforeStart: number;
      afterEnd: number;
      examples: Array<{
        activityId: string;
        loggedDate: number;
        issue: string;
      }>;
    }> = [];

    for (const challenge of challenges) {
      const activities = await ctx.db
        .query("activities")
        .withIndex("challengeId", (q) => q.eq("challengeId", challenge._id))
        .filter(notDeleted)
        .collect();

      const challengeStartMs = dateOnlyToUtcMs(challenge.startDate);
      const challengeEndMs = dateOnlyToUtcMs(challenge.endDate);
      const beforeStart = activities.filter((a) => a.loggedDate < challengeStartMs);
      const afterEnd = activities.filter((a) => a.loggedDate > challengeEndMs);

      if (beforeStart.length > 0 || afterEnd.length > 0) {
        const examples: Array<{ activityId: string; loggedDate: number; issue: string }> = [];

        beforeStart.slice(0, 3).forEach((a) => {
          examples.push({
            activityId: a._id,
            loggedDate: a.loggedDate,
            issue: `Before start: ${new Date(a.loggedDate).toISOString()} < ${new Date(challengeStartMs).toISOString()}`,
          });
        });

        afterEnd.slice(0, 3).forEach((a) => {
          examples.push({
            activityId: a._id,
            loggedDate: a.loggedDate,
            issue: `After end: ${new Date(a.loggedDate).toISOString()} > ${new Date(challengeEndMs).toISOString()}`,
          });
        });

        results.push({
          challengeId: challenge._id,
          challengeName: challenge.name,
          startDate: coerceDateOnlyToString(challenge.startDate),
          endDate: coerceDateOnlyToString(challenge.endDate),
          totalActivities: activities.length,
          outOfBounds: beforeStart.length + afterEnd.length,
          beforeStart: beforeStart.length,
          afterEnd: afterEnd.length,
          examples,
        });
      }
    }

    return results;
  },
});

/**
 * List flagged activities for a challenge
 */
export const listFlaggedActivities = query({
  args: {
    challengeId: v.id("challenges"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("resolved")
      )
    ),
    participantId: v.optional(v.id("users")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    // Get flagged activities for this challenge using compound index
    let activities = await ctx.db
      .query("activities")
      .withIndex("challengeFlagged", (q) =>
        q.eq("challengeId", args.challengeId).eq("flagged", true)
      )
      .filter(notDeleted)
      .collect();

    // Filter by status if provided
    if (args.status) {
      activities = activities.filter((a) => a.resolutionStatus === args.status);
    }

    // Filter by participant if provided
    if (args.participantId) {
      activities = activities.filter((a) => a.userId === args.participantId);
    }

    // Sort by flaggedAt descending, then createdAt descending
    activities.sort((a, b) => {
      const aFlagged = a.flaggedAt ?? 0;
      const bFlagged = b.flaggedAt ?? 0;
      if (bFlagged !== aFlagged) return bFlagged - aFlagged;
      return b.createdAt - a.createdAt;
    });

    const total = activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);

    // Fetch related data
    const items = await Promise.all(
      paginatedActivities.map(async (activity) => {
        const user = await ctx.db.get(activity.userId);
        const activityType = activity.activityTypeId
          ? await ctx.db.get(activity.activityTypeId)
          : null;

        // Apply search filter
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          const nameMatch = user?.name?.toLowerCase().includes(searchLower);
          const emailMatch = user?.email?.toLowerCase().includes(searchLower);
          const reasonMatch = activity.flaggedReason
            ?.toLowerCase()
            .includes(searchLower);

          if (!nameMatch && !emailMatch && !reasonMatch) {
            return null;
          }
        }

        return {
          activity: {
            id: activity._id,
            flaggedReason: activity.flaggedReason,
            flaggedAt: activity.flaggedAt,
            resolutionStatus: activity.resolutionStatus,
            pointsEarned: activity.pointsEarned,
            loggedDate: activity.loggedDate,
            notes: activity.notes,
          },
          participant: user
            ? {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
          activityType: activityType
            ? {
                id: activityType._id,
                name: activityType.name,
              }
            : null,
        };
      })
    );

    return {
      items: items.filter((item) => item !== null && item.participant !== null),
      total,
    };
  },
});

/**
 * Get flagged activity detail
 */
export const getFlaggedActivityDetail = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) {
      return null;
    }

    const user = await ctx.db.get(activity.userId);
    const activityType = activity.activityTypeId
      ? await ctx.db.get(activity.activityTypeId)
      : null;

    // Get history
    const history = await ctx.db
      .query("activityFlagHistory")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .collect();

    // Sort by createdAt descending
    history.sort((a, b) => b.createdAt - a.createdAt);

    // Fetch actors for history entries
    const historyWithActors = await Promise.all(
      history.map(async (entry) => {
        const actor = await ctx.db.get(entry.actorId);
        return {
          entry: {
            id: entry._id,
            actionType: entry.actionType,
            payload: entry.payload,
            createdAt: entry.createdAt,
          },
          actor: actor
            ? {
                id: actor._id,
                name: actor.name,
                email: actor.email,
                avatarUrl: actor.avatarUrl,
              }
            : null,
        };
      })
    );

    return {
      activity: {
        id: activity._id,
        challengeId: activity.challengeId,
        activityTypeId: activity.activityTypeId,
        flagged: activity.flagged,
        flaggedReason: activity.flaggedReason,
        flaggedAt: activity.flaggedAt,
        resolutionStatus: activity.resolutionStatus,
        resolutionNotes: activity.resolutionNotes,
        resolvedAt: activity.resolvedAt,
        pointsEarned: activity.pointsEarned,
        loggedDate: activity.loggedDate,
        notes: activity.notes,
        metrics: activity.metrics,
        adminComment: activity.adminComment,
        adminCommentVisibility: activity.adminCommentVisibility,
        source: activity.source,
        externalId: activity.externalId,
        createdAt: activity.createdAt,
      },
      participant: user
        ? {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            username: user.username,
          }
        : null,
      activityType: activityType
        ? {
            id: activityType._id,
            name: activityType.name,
          }
        : null,
      history: historyWithActors,
    };
  },
});

/**
 * List payments for a challenge
 */
export const listChallengePayments = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by paymentReceivedAt descending, then joinedAt descending
    participations.sort((a, b) => {
      const aPayment = a.paymentReceivedAt ?? 0;
      const bPayment = b.paymentReceivedAt ?? 0;
      if (bPayment !== aPayment) return bPayment - aPayment;
      return b.joinedAt - a.joinedAt;
    });

    const result = await Promise.all(
      participations.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          participant: user
            ? {
                id: user._id,
                name: user.name,
                email: user.email,
              }
            : null,
          paymentStatus: p.paymentStatus,
          paymentReceivedAt: p.paymentReceivedAt,
          paymentReference: p.paymentReference,
          totalPoints: p.totalPoints,
        };
      })
    );

    return result.filter((item) => item.participant !== null);
  },
});

/**
 * Get activity types and integration mappings for scoring preview (internal)
 */
export const getScoringPreviewData = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    // Get all activity types for this challenge
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Get all Strava integration mappings for this challenge
    const integrationMappings = await ctx.db
      .query("integrationMappings")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter((q) => q.eq(q.field("service"), "strava"))
      .collect();

    return {
      activityTypes: activityTypes.map((at) => ({
        _id: at._id,
        name: at.name,
        scoringConfig: at.scoringConfig as Record<string, unknown>,
        bonusThresholds: at.bonusThresholds,
        isNegative: at.isNegative,
      })),
      integrationMappings: integrationMappings.map((im) => ({
        externalType: im.externalType,
        activityTypeId: im.activityTypeId,
        metricMapping: im.metricMapping as
          | {
              primaryMetric: string;
              conversionFactor?: number;
              targetMetric?: string;
            }
          | undefined,
      })),
    };
  },
});
