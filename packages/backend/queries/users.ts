import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { coerceDateOnlyToString } from "../lib/dateOnly";
import { internalQuery } from "../_generated/server";
import { notDeleted } from "../lib/activityFilters";

/**
 * Get current authenticated user
 * Links Better Auth users to our users table via email
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Look up user by email (Better Auth provides email in the identity)
    if (identity.email) {
      return await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", identity.email as string))
        .first();
    }

    return null;
  },
});

export const getByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Get user by ID
 */
export const getById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get user by email (for matching imported users)
 */
export const getByEmailPublic = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Check if user is participating in a challenge
 */
export const isParticipating = query({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId),
      )
      .first();

    return participation !== null;
  },
});

/**
 * Get user profile with challenge-specific stats
 */
export const getProfile = query({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const [user, challenge, participation] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.challengeId),
      ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", args.userId).eq("challengeId", args.challengeId)
        )
        .first(),
    ]);

    if (!user || !challenge) {
      return null;
    }

    // Get all participations in this challenge for ranking
    const allParticipations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by total points descending to get rank
    const sortedParticipations = allParticipations.sort(
      (a, b) => b.totalPoints - a.totalPoints
    );
    const rank = participation
      ? sortedParticipations.findIndex((p) => p.userId === args.userId) + 1
      : null;

    // Get activity count for this user in this challenge
    const activities = await ctx.db
      .query("activities")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .filter(notDeleted)
      .collect();

    const challengeActivities = activities.filter(
      (a) => a.challengeId === args.challengeId
    );

    // Get recent activities (last 5)
    const recentActivities = challengeActivities
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    // Enrich recent activities with activity type names
    const enrichedActivities = await Promise.all(
      recentActivities.map(async (activity) => {
        const activityType = await ctx.db.get(activity.activityTypeId);
        return {
          ...activity,
          activityTypeName: activityType?.name ?? "Unknown",
        };
      })
    );

    return {
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      challenge: {
        id: challenge._id,
        name: challenge.name,
      },
      participation: participation
        ? {
            totalPoints: participation.totalPoints,
            currentStreak: participation.currentStreak,
            joinedAt: participation.joinedAt,
            rank,
            totalParticipants: allParticipations.length,
          }
        : null,
      stats: {
        totalActivities: challengeActivities.length,
        recentActivities: enrichedActivities,
      },
    };
  },
});

/**
 * Get global user profile (across all challenges)
 */
export const getGlobalProfile = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Get all participations for this user
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Get all activities for this user
    const activities = await ctx.db
      .query("activities")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .filter(notDeleted)
      .collect();

    // Calculate totals
    const totalActivities = activities.length;
    const totalPoints = participations.reduce((sum, p) => sum + p.totalPoints, 0);

    // Get challenge details for participations
    const participationsWithChallenges = await Promise.all(
      participations.map(async (p) => {
        const challenge = await ctx.db.get(p.challengeId);
        return {
          challenge: challenge
            ? {
                id: challenge._id,
                name: challenge.name,
                startDate: coerceDateOnlyToString(challenge.startDate),
                endDate: coerceDateOnlyToString(challenge.endDate),
              }
            : null,
          totalPoints: p.totalPoints,
          currentStreak: p.currentStreak,
          joinedAt: p.joinedAt,
        };
      })
    );

    // Filter out nulls and sort by joinedAt descending
    const validParticipations = participationsWithChallenges
      .filter((p) => p.challenge !== null)
      .sort((a, b) => b.joinedAt - a.joinedAt);

    // Get recent activities (last 10) with challenge names
    const recentActivities = activities
      .sort((a, b) => b.loggedDate - a.loggedDate || b.createdAt - a.createdAt)
      .slice(0, 10);

    const recentActivitiesWithChallenges = await Promise.all(
      recentActivities.map(async (activity) => {
        const challenge = await ctx.db.get(activity.challengeId);
        return {
          activity: {
            id: activity._id,
            loggedDate: activity.loggedDate,
            pointsEarned: activity.pointsEarned,
            notes: activity.notes,
          },
          challenge: challenge
            ? {
                id: challenge._id,
                name: challenge.name,
              }
            : null,
        };
      })
    );

    return {
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      stats: {
        totalActivities,
        totalPoints,
      },
      participations: validParticipations,
      recentActivities: recentActivitiesWithChallenges.filter(
        (a) => a.challenge !== null
      ),
    };
  },
});

/**
 * Get paginated activities for a user in a challenge
 */
export const getActivities = query({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // We need to filter by both userId and challengeId
    // First get all activities for this user, then filter
    const activities = await ctx.db
      .query("activities")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .filter(notDeleted)
      .order("desc")
      .collect();

    // Filter to just this challenge
    const challengeActivities = activities.filter(
      (a) => a.challengeId === args.challengeId
    );

    // Manual pagination
    const startIndex = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor)
      : 0;
    const numItems = args.paginationOpts.numItems;
    const pageActivities = challengeActivities.slice(
      startIndex,
      startIndex + numItems
    );

    // Enrich with activity type and like/comment counts
    const enrichedPage = await Promise.all(
      pageActivities.map(async (activity) => {
        const [activityType, likeCount, commentCount] = await Promise.all([
          ctx.db.get(activity.activityTypeId),
          ctx.db
            .query("likes")
            .withIndex("activityId", (q) => q.eq("activityId", activity._id))
            .collect()
            .then((likes) => likes.length),
          ctx.db
            .query("comments")
            .withIndex("activityId", (q) => q.eq("activityId", activity._id))
            .collect()
            .then((comments) => comments.length),
        ]);

        return {
          activity,
          activityType: activityType
            ? { id: activityType._id, name: activityType.name }
            : null,
          likes: likeCount,
          comments: commentCount,
        };
      })
    );

    const hasMore = startIndex + numItems < challengeActivities.length;

    return {
      page: enrichedPage,
      isDone: !hasMore,
      continueCursor: hasMore ? String(startIndex + numItems) : null,
    };
  },
});
