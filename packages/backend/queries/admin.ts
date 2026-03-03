import { query, internalQuery, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { coerceDateOnlyToString, dateOnlyToUtcMs } from "../lib/dateOnly";
import { notDeleted } from "../lib/activityFilters";
import { getCurrentUser } from "../lib/ids";
import {
  FOLLOWING_BOOST,
  computeAffinityBoost,
  getFeedDayBucket,
  getRankInFeedBucket,
  computePersonalizedRank,
} from "../lib/feedScoring";
import type { Id } from "../_generated/dataModel";

async function getChallengeAdminUser(
  ctx: QueryCtx,
  challengeId: Id<"challenges">,
) {
  const user = await getCurrentUser(ctx);
  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    return user;
  }

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (challenge.creatorId === user._id) {
    return user;
  }

  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q) =>
      q.eq("userId", user._id).eq("challengeId", challengeId)
    )
    .first();

  if (participation?.role === "admin") {
    return user;
  }

  return null;
}

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
 * Admin monitoring dashboard analytics:
 * - Created-at (UTC) hourly distribution for activities
 * - Feed debug rows with explicit score/rank/personalization details
 * - "View as" support to inspect personalization effects for another participant
 */
export const getMonitoringDashboard = query({
  args: {
    challengeId: v.id("challenges"),
    viewAsUserId: v.optional(v.id("users")),
    feedLimit: v.optional(v.number()),
    includeFeedDebug: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminUser = await getChallengeAdminUser(ctx, args.challengeId);
    if (!adminUser) {
      return null;
    }
    const feedLimit = Math.min(Math.max(args.feedLimit ?? 100, 10), 200);
    const includeFeedDebug = args.includeFeedDebug ?? true;

    const [activities, participations] = await Promise.all([
      ctx.db
        .query("activities")
        .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
        .filter(notDeleted)
        .collect(),
      includeFeedDebug
        ? ctx.db
            .query("userChallenges")
            .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
            .collect()
        : Promise.resolve([]),
    ]);

    const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      count: 0,
    }));
    const activityTypeCountMap = new Map<string, number>();

    for (const activity of activities) {
      hourlyCounts[new Date(activity.createdAt).getUTCHours()].count += 1;
      const key = activity.activityTypeId as string;
      activityTypeCountMap.set(key, (activityTypeCountMap.get(key) ?? 0) + 1);
    }
    const activityTypeCounts = Array.from(activityTypeCountMap.entries()).map(
      ([activityTypeId, count]) => ({ activityTypeId, count }),
    );

    if (!includeFeedDebug) {
      return {
        totalActivities: activities.length,
        hourlyCounts,
        activityTypeCounts,
        feed: {
          viewer: {
            id: adminUser._id,
            username: adminUser.username,
            name: adminUser.name ?? null,
            email: adminUser.email,
            isCurrentAdmin: true,
          },
          followingCount: 0,
          rows: [],
        },
        viewAsCandidates: [],
      };
    }

    const participantIds = new Set(participations.map((p) => p.userId));

    const viewerId = args.viewAsUserId ?? adminUser._id;
    const viewAsUser = await ctx.db.get(viewerId);
    if (!viewAsUser) {
      throw new Error("Selected view-as user not found");
    }

    if (viewerId !== adminUser._id && !participantIds.has(viewerId)) {
      throw new Error("Selected view-as user is not a challenge participant");
    }

    const [followingRows, affinityRows] = await Promise.all([
      ctx.db
        .query("follows")
        .withIndex("followerId", (q) => q.eq("followerId", viewerId))
        .collect(),
      ctx.db
        .query("userAffinities")
        .withIndex("challengeViewer", (q) =>
          q.eq("challengeId", args.challengeId).eq("viewerUserId", viewerId),
        )
        .collect(),
    ]);
    const followingIds = new Set(followingRows.map((row) => row.followingId));
    const affinityByAuthor = new Map(
      affinityRows.map((row) => [row.authorUserId as string, row.score]),
    );

    const userMap = new Map(
      (
        await Promise.all(
          participations.map(async (participation) => {
            const user = await ctx.db.get(participation.userId);
            if (!user) return null;
            return [
              user._id,
              {
                id: user._id,
                username: user.username,
                name: user.name ?? null,
                email: user.email,
              },
            ] as const;
          }),
        )
      ).filter((entry): entry is readonly [Id<"users">, { id: Id<"users">; username: string; name: string | null; email: string }] => entry !== null),
    );

    const activityTypeIds = new Set(activities.map((activity) => activity.activityTypeId));
    const activityTypeMap = new Map(
      (
        await Promise.all(
          Array.from(activityTypeIds).map(async (activityTypeId) => {
            const activityType = await ctx.db.get(activityTypeId);
            if (!activityType) return null;
            return [activityType._id, { id: activityType._id, name: activityType.name }] as const;
          }),
        )
      ).filter((entry): entry is readonly [Id<"activityTypes">, { id: Id<"activityTypes">; name: string }] => entry !== null),
    );

    const feedRows = [...activities]
      .filter((activity) => typeof activity.feedRank === "number")
      .sort((a, b) => (b.feedRank ?? 0) - (a.feedRank ?? 0))
      .slice(0, feedLimit)
      .map((activity) => {
        const actor = userMap.get(activity.userId);
        if (!actor) {
          return null;
        }

        const type = activityTypeMap.get(activity.activityTypeId);
        const isFollowing = followingIds.has(activity.userId);
        const affinityScore = affinityByAuthor.get(activity.userId as string) ?? 0;
        const affinityBoostApplied = computeAffinityBoost(affinityScore);
        const feedRank = activity.feedRank ?? 0;
        const personalizedRank = computePersonalizedRank(
          feedRank,
          isFollowing,
          affinityScore,
        );
        const feedScore = activity.feedScore ?? 0;
        const dayBucket = getFeedDayBucket(activity.createdAt);
        const rankInDayBucket = getRankInFeedBucket(feedRank, activity.createdAt);

        return {
          activityId: activity._id,
          createdAt: activity.createdAt,
          loggedDate: activity.loggedDate,
          pointsEarned: activity.pointsEarned,
          source: activity.source,
          user: actor,
          activityType: type ?? null,
          debug: {
            feedScore,
            feedRank,
            personalizedRank,
            followingBoostApplied: isFollowing ? FOLLOWING_BOOST : 0,
            affinityScore,
            affinityBoostApplied,
            totalBoostApplied:
              (isFollowing ? FOLLOWING_BOOST : 0) + affinityBoostApplied,
            isFollowingAuthor: isFollowing,
            dayBucket,
            rankInDayBucket,
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      // Match "For You" display ordering (personalized score first).
      .sort((a, b) => {
        if (b.debug.personalizedRank !== a.debug.personalizedRank) {
          return b.debug.personalizedRank - a.debug.personalizedRank;
        }
        return b.debug.feedRank - a.debug.feedRank;
      });

    const viewAsCandidates = [...userMap.values()];
    if (!viewAsCandidates.some((candidate) => candidate.id === adminUser._id)) {
      viewAsCandidates.push({
        id: adminUser._id,
        username: adminUser.username,
        name: adminUser.name ?? null,
        email: adminUser.email,
      });
    }

    viewAsCandidates.sort((a, b) => {
      const aDisplay = (a.name ?? a.username).toLowerCase();
      const bDisplay = (b.name ?? b.username).toLowerCase();
      return aDisplay.localeCompare(bDisplay);
    });

    return {
      totalActivities: activities.length,
      hourlyCounts,
      activityTypeCounts,
      feed: {
        viewer: {
          id: viewAsUser._id,
          username: viewAsUser.username,
          name: viewAsUser.name ?? null,
          email: viewAsUser.email,
          isCurrentAdmin: viewAsUser._id === adminUser._id,
        },
        followingCount: followingIds.size,
        rows: feedRows,
      },
      viewAsCandidates,
    };
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
