import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";
import { coerceDateOnlyToString, dateOnlyToUtcMs } from "../lib/dateOnly";
import { getChallengePointsByUser, getPointsForUser } from "../lib/challengePoints";
import { notDeleted } from "../lib/activityFilters";

/**
 * Internal query to get challenge with activity types (for scripts/migrations)
 */
export const getByIdInternal = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    return {
      ...challenge,
      activityTypes,
    };
  },
});

export const getByName = internalQuery({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const challenges = await ctx.db.query("challenges").collect();
    return challenges.find((challenge) => challenge.name === args.name) ?? null;
  },
});

/**
 * Get public challenges with participant counts
 */
export const listPublic = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    // Fetch a bounded number of challenges instead of the entire table.
    // Take extra to compensate for private challenges being filtered out.
    const fetchLimit = (offset + limit) * 3 + 20;
    const challenges = await ctx.db
      .query("challenges")
      .order("desc")
      .take(fetchLimit);

    // Filter out private challenges
    const publicChallenges = challenges.filter(
      (c) => !c.visibility || c.visibility === "public"
    );

    // Sort by startDate descending (most recent first)
    publicChallenges.sort((a, b) => dateOnlyToUtcMs(b.startDate) - dateOnlyToUtcMs(a.startDate));

    // Get participant counts in parallel for the paginated slice
    const paginatedChallenges = publicChallenges.slice(offset, offset + limit);
    const challengesWithCounts = await Promise.all(
      paginatedChallenges.map(async (challenge) => {
        const participations = await ctx.db
          .query("userChallenges")
          .withIndex("challengeId", (q) => q.eq("challengeId", challenge._id))
          .collect();

        return {
          id: challenge._id,
          name: challenge.name,
          description: challenge.description,
          startDate: coerceDateOnlyToString(challenge.startDate),
          endDate: coerceDateOnlyToString(challenge.endDate),
          durationDays: challenge.durationDays,
          createdAt: challenge.createdAt,
          participantCount: participations.length,
        };
      }),
    );

    return challengesWithCounts;
  },
});

/**
 * Get challenges for the current user
 */
export const listForUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    // Get challenges where user is creator or participant
    const userParticipations = await ctx.db
      .query("userChallenges")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    const challengeIds = new Set<Id<"challenges">>();

    // Add challenges where user is participant
    userParticipations.forEach((p) => {
      challengeIds.add(p.challengeId);
    });

    // Get challenges where user is creator
    const createdChallenges = await ctx.db
      .query("challenges")
      .withIndex("creatorId", (q) => q.eq("creatorId", args.userId))
      .collect();

    createdChallenges.forEach((c) => {
      challengeIds.add(c._id);
    });

    // Fetch all challenges
    const allChallenges = await Promise.all(
      Array.from(challengeIds).map((id) => ctx.db.get(id)),
    );

    const validChallenges = allChallenges.filter(
      (c): c is Doc<"challenges"> => c !== null,
    );

    // Sort by startDate descending
    validChallenges.sort((a, b) => dateOnlyToUtcMs(b.startDate) - dateOnlyToUtcMs(a.startDate));

    // Apply pagination
    const paginated = validChallenges.slice(offset, offset + limit);
    const userActivities = await ctx.db
      .query("activities")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .filter(notDeleted)
      .collect();
    const pointsByChallenge = new Map<string, number>();
    for (const activity of userActivities) {
      const key = activity.challengeId as string;
      pointsByChallenge.set(
        key,
        (pointsByChallenge.get(key) ?? 0) + activity.pointsEarned
      );
    }

    // Get participation data
    const result = await Promise.all(
      paginated.map(async (challenge) => {
        const participation = userParticipations.find(
          (p) => p.challengeId === challenge._id,
        );

        return {
          ...challenge,
          id: challenge._id,
          startDate: coerceDateOnlyToString(challenge.startDate),
          endDate: coerceDateOnlyToString(challenge.endDate),
          isParticipant: Boolean(participation),
          participantStats: participation
            ? {
                totalPoints: pointsByChallenge.get(challenge._id as string) ?? 0,
                currentStreak: participation.currentStreak,
              }
            : null,
        };
      }),
    );

    return result;
  },
});

/**
 * Get a challenge by ID with participant count
 */
export const getByIdWithCount = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    // Get participant count
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    return {
      ...challenge,
      id: challenge._id,
      startDate: coerceDateOnlyToString(challenge.startDate),
      endDate: coerceDateOnlyToString(challenge.endDate),
      participantCount: participations.length,
    };
  },
});

/**
 * Get a challenge by ID with related data
 */
export const getById = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    // Get related data
    const [activityTypes, bonusRules, integrationMappings] = await Promise.all([
      ctx.db
        .query("activityTypes")
        .withIndex("challengeId", (q) =>
          q.eq("challengeId", args.challengeId),
        )
        .collect(),
      ctx.db
        .query("bonusRules")
        .withIndex("challengeId", (q) =>
          q.eq("challengeId", args.challengeId),
        )
        .collect(),
      ctx.db
        .query("integrationMappings")
        .withIndex("challengeId", (q) =>
          q.eq("challengeId", args.challengeId),
        )
        .collect(),
    ]);

    return {
      ...challenge,
      startDate: coerceDateOnlyToString(challenge.startDate),
      endDate: coerceDateOnlyToString(challenge.endDate),
      id: challenge._id,
      activityTypes,
      bonusRules,
      integrationMappings,
    };
  },
});

/**
 * Get challenge dashboard data
 */
export const getDashboardData = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    // Get participation (only if userId provided)
    let participation = null;
    if (args.userId) {
      const userId = args.userId;
      participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", userId).eq("challengeId", args.challengeId),
        )
        .first();
    }

    // Get all participations for leaderboard
    const allParticipations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const pointsByUser = await getChallengePointsByUser(ctx, args.challengeId);

    const scoredParticipations = allParticipations.map((p) => ({
      ...p,
      computedTotalPoints: getPointsForUser(pointsByUser, p.userId),
    }));

    // Sort by computed totalPoints descending
    scoredParticipations.sort(
      (a, b) => b.computedTotalPoints - a.computedTotalPoints
    );

    // Get top 10 leaderboard with user data
    const leaderboard = await Promise.all(
      scoredParticipations.slice(0, 10).map(async (p) => {
        const user = await ctx.db.get(p.userId);
        if (!user) return null;

        return {
          participantId: p.userId,
          totalPoints: p.computedTotalPoints,
          currentStreak: p.currentStreak,
          user: {
            id: user._id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
          },
        };
      }),
    );

    const validLeaderboard = leaderboard.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    // Calculate user rank (only if participation exists)
    let userRank: number | null = null;
    const participationPoints = participation
      ? getPointsForUser(pointsByUser, participation.userId)
      : 0;
    if (participation) {
      const higherCount = scoredParticipations.filter(
        (p) => p.computedTotalPoints > participationPoints,
      ).length;
      userRank = higherCount + 1;
    }

    // Get latest activity efficiently (only fetch 1)
    const recentActivities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter(notDeleted)
      .order("desc")
      .take(1);
    const latestActivity = recentActivities[0] ?? null;

    // Skip expensive activity count - just return 0 for now
    // TODO: Add denormalized activityCount field to challenge for accurate counts
    const totalActivities = 0;

    // Calculate totals
    const totalParticipants = allParticipations.length;
    const totalPoints = scoredParticipations.reduce(
      (sum, p) => sum + p.computedTotalPoints,
      0,
    );

    return {
      challenge: {
        ...challenge,
        id: challenge._id,
        startDate: coerceDateOnlyToString(challenge.startDate),
        endDate: coerceDateOnlyToString(challenge.endDate),
      },
      participation: participation
        ? {
            ...participation,
            totalPoints: participationPoints,
          }
        : null,
      leaderboard: validLeaderboard,
      stats: {
        totalActivities,
        totalParticipants,
        totalPoints,
        userRank,
        userPoints: participationPoints,
        userStreak: participation?.currentStreak ?? 0,
      },
      latestActivityId: latestActivity?._id ?? null,
    };
  },
});

/**
 * Get challenge participants
 */
export const getParticipants = query({
  args: {
    challengeId: v.id("challenges"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    const pointsByUser = await getChallengePointsByUser(ctx, args.challengeId);
    const scoredParticipations = participations.map((p) => ({
      ...p,
      computedTotalPoints: getPointsForUser(pointsByUser, p.userId),
    }));

    // Sort by activity-derived points descending
    scoredParticipations.sort((a, b) => b.computedTotalPoints - a.computedTotalPoints);

    // Apply pagination
    const paginated = scoredParticipations.slice(offset, offset + limit);

    // Get user data
    const result = await Promise.all(
      paginated.map(async (participation) => {
        const user = await ctx.db.get(participation.userId);
        if (!user) {
          return null;
        }

        return {
          user: {
            id: user._id,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
          stats: {
            totalPoints: participation.computedTotalPoints,
            currentStreak: participation.currentStreak,
            modifierFactor: participation.modifierFactor,
          },
          role: participation.role ?? "member",
          paymentStatus: participation.paymentStatus,
        };
      }),
    );

    return result.filter((item): item is NonNullable<typeof item> => item !== null);
  },
});
