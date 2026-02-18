import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUser } from "../lib/ids";
import { getChallengeWeekNumber, getWeekDateRange, getTotalWeeks } from "../lib/weeks";
import type { Id } from "../_generated/dataModel";
import { notDeleted } from "../lib/activityFilters";
import { dateOnlyToUtcMs } from "../lib/dateOnly";

/**
 * Get recent participants for a challenge
 */
export const getRecent = query({
  args: {
    challengeId: v.id("challenges"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by joinedAt descending (most recent first)
    participations.sort((a, b) => b.joinedAt - a.joinedAt);

    // Get user data for recent participants
    const result = await Promise.all(
      participations.slice(0, limit).map(async (participation) => {
        const user = await ctx.db.get(participation.userId);
        if (!user) {
          return null;
        }

        return {
          id: user._id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          joinedAt: participation.joinedAt,
        };
      }),
    );

    return result.filter((item): item is NonNullable<typeof item> => item !== null);
  },
});

/**
 * Get participation by user and challenge
 */
export const getByUserAndChallenge = query({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId),
      )
      .first();
  },
});

/**
 * Get participation by ID
 */
export const getById = query({
  args: {
    participationId: v.id("userChallenges"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.participationId);
  },
});

/**
 * Get participants for a challenge with pagination
 */
export const getChallengeParticipants = query({
  args: {
    challengeId: v.id("challenges"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      participations.page.map(async (participation) => {
        const user = await ctx.db.get(participation.userId);
        return {
          participation,
          user: user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null,
        };
      })
    );

    return {
      ...participations,
      page: page
        .filter((item) => item.user !== null)
        .map((item) => ({
          user: item.user!,
          stats: {
            totalPoints: item.participation.totalPoints,
            currentStreak: item.participation.currentStreak,
            modifierFactor: item.participation.modifierFactor,
          },
        }))
        .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints), // Sort by points descending
    };
  },
});

/**
 * Get challenge participants ordered by points (leaderboard)
 */
export const getChallengeLeaderboard = query({
  args: {
    challengeId: v.id("challenges"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by totalPoints descending
    participations.sort((a, b) => b.totalPoints - a.totalPoints);

    const limit = args.paginationOpts.numItems;
    const cursorIndex = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const paginatedItems = participations.slice(cursorIndex, cursorIndex + limit);

    const isDone = cursorIndex + limit >= participations.length;
    const continueCursor = isDone ? null : (cursorIndex + limit).toString();

    const page = await Promise.all(
      paginatedItems.map(async (participation, index) => {
        const user = await ctx.db.get(participation.userId);
        return {
            rank: cursorIndex + index + 1,
            user: user ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
            } : null,
            totalPoints: participation.totalPoints,
            currentStreak: participation.currentStreak,
        };
      })
    );

    return {
      page: page.filter((item) => item.user !== null).map(p => ({...p, user: p.user!})),
      continueCursor,
      isDone,
    };
  },
});

/**
 * Get full leaderboard for a challenge (all participants)
 * Optimized to batch user lookups
 */
export const getFullLeaderboard = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    // Get all participations
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by totalPoints descending
    participations.sort((a, b) => b.totalPoints - a.totalPoints);

    // Batch fetch all users in parallel
    const entries = await Promise.all(
      participations.map(async (participation, index) => {
        const user = await ctx.db.get(participation.userId);
        if (!user) return null;

        return {
          rank: index + 1,
          user: {
            id: user._id,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
          totalPoints: participation.totalPoints,
          currentStreak: participation.currentStreak,
        };
      })
    );

    return entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  },
});

/**
 * Get list of users for mentions (limited to 100 for now)
 */
export const getMentionable = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .take(100); // Limit to 100 for now to match previous behavior

    const users = await Promise.all(
      participations.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        if (!user) return null;
        return {
            id: user._id,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl
        };
      })
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  }
});

/**
 * Get all challenges a user is participating in
 */
export const getUserChallenges = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    const challenges = await Promise.all(
      participations.map(async (p) => {
        const challenge = await ctx.db.get(p.challengeId);
        return challenge;
      })
    );

    return challenges
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => {
        const aDate = typeof a.startDate === "string" ? dateOnlyToUtcMs(a.startDate) : a.startDate;
        const bDate = typeof b.startDate === "string" ? dateOnlyToUtcMs(b.startDate) : b.startDate;
        return bDate - aDate;
      }); // Sort by start date descending (most recent first)
  },
});

/**
 * Get count of participants in a challenge
 */
export const getCount = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    return participations.length;
  },
});

/**
 * Check if the current user is an admin for a challenge
 * Returns true if:
 * - User is a global admin (user.role === "admin")
 * - User is the challenge creator
 * - User has admin role in their participation
 */
export const isUserChallengeAdmin = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { isAdmin: false, reason: null };
    }

    // Check if global admin
    if (user.role === "admin") {
      return { isAdmin: true, reason: "global_admin" as const };
    }

    // Check if challenge creator
    const challenge = await ctx.db.get(args.challengeId);
    if (challenge && challenge.creatorId === user._id) {
      return { isAdmin: true, reason: "creator" as const };
    }

    // Check if has admin role in participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (participation?.role === "admin") {
      return { isAdmin: true, reason: "challenge_admin" as const };
    }

    return { isAdmin: false, reason: null };
  },
});

/**
 * Get current user's participation in a challenge
 * Used for checking announcement dismissal state, etc.
 */
export const getCurrentUserParticipation = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();
  },
});

/**
 * Debug: Check admin status with full details
 */
export const debugAdminStatus = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = await getCurrentUser(ctx);

    if (!user) {
      return {
        error: "User not found",
        identity: identity ? { subject: identity.subject, email: identity.email } : null,
      };
    }

    const challenge = await ctx.db.get(args.challengeId);
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    return {
      identity: identity ? {
        subject: identity.subject,
        email: identity.email,
      } : null,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      challenge: challenge ? {
        id: challenge._id,
        creatorId: challenge.creatorId,
        isCreator: challenge.creatorId === user._id,
      } : null,
      participation: participation ? {
        id: participation._id,
        role: participation.role,
      } : null,
      adminChecks: {
        isGlobalAdmin: user.role === "admin",
        isCreator: challenge?.creatorId === user._id,
        isParticipationAdmin: participation?.role === "admin",
      }
    };
  },
});

/**
 * Get cumulative (all-time) category leaderboard for a challenge.
 * Returns top 5 users per category, split by gender (women / men / noGender).
 */
export const getCumulativeCategoryLeaderboard = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    // Fetch activity types for this challenge
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const activityTypeMap = new Map(
      activityTypes.map((at) => [at._id, at])
    );

    // Collect unique category IDs and fetch category docs
    const categoryIds = new Set<Id<"categories">>();
    for (const at of activityTypes) {
      if (at.categoryId) categoryIds.add(at.categoryId);
    }
    const categoryDocs = await Promise.all(
      Array.from(categoryIds).map((id) => ctx.db.get(id))
    );
    const categoryMap = new Map(
      categoryDocs
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    );

    // Query ALL non-deleted activities for this challenge
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter(notDeleted)
      .collect();

    // Group points: categoryId -> userId -> totalPoints
    const categoryUserPoints = new Map<string, Map<string, number>>();

    for (const activity of activities) {
      const at = activityTypeMap.get(activity.activityTypeId);
      if (!at) continue;

      const catId = at.categoryId ?? "uncategorized";
      const catKey = catId as string;

      if (!categoryUserPoints.has(catKey)) {
        categoryUserPoints.set(catKey, new Map());
      }
      const userPoints = categoryUserPoints.get(catKey)!;
      const current = userPoints.get(activity.userId) ?? 0;
      userPoints.set(activity.userId, current + activity.pointsEarned);
    }

    // Cache for user lookups
    const userCache = new Map<
      string,
      {
        id: string;
        name: string | null;
        username: string;
        avatarUrl: string | null;
        gender: string | null;
      } | null
    >();

    const categories = await Promise.all(
      Array.from(categoryUserPoints.entries()).map(async ([catKey, userPointsMap]) => {
        // Sort all users by points descending
        const sorted = Array.from(userPointsMap.entries()).sort((a, b) => b[1] - a[1]);

        // Fetch user data with caching and split by gender
        const womenEntries: Array<{ rank: number; user: NonNullable<typeof userCache extends Map<string, infer V> ? V : never>; totalPoints: number }> = [];
        const menEntries: Array<{ rank: number; user: NonNullable<typeof userCache extends Map<string, infer V> ? V : never>; totalPoints: number }> = [];
        const noGenderEntries: Array<{ rank: number; user: NonNullable<typeof userCache extends Map<string, infer V> ? V : never>; totalPoints: number }> = [];

        for (const [userId, points] of sorted) {
          if (!userCache.has(userId)) {
            const user = await ctx.db.get(userId as Id<"users">);
            userCache.set(
              userId,
              user
                ? {
                    id: user._id,
                    name: user.name ?? null,
                    username: user.username,
                    avatarUrl: user.avatarUrl ?? null,
                    gender: user.gender ?? null,
                  }
                : null
            );
          }
          const user = userCache.get(userId);
          if (!user) continue;

          if (user.gender === "female") {
            womenEntries.push({ rank: 0, user, totalPoints: points });
          } else if (user.gender === "male") {
            menEntries.push({ rank: 0, user, totalPoints: points });
          } else {
            noGenderEntries.push({ rank: 0, user, totalPoints: points });
          }
        }

        // Assign ranks and take top 5 per gender group
        const assignRanks = <T extends { rank: number }>(arr: T[]): T[] =>
          arr.slice(0, 5).map((e, i) => ({ ...e, rank: i + 1 }));

        const category =
          catKey === "uncategorized"
            ? { id: "uncategorized" as string, name: "Other" }
            : categoryMap.has(catKey as Id<"categories">)
              ? { id: catKey, name: categoryMap.get(catKey as Id<"categories">)!.name }
              : { id: catKey, name: "Unknown" };

        return {
          category,
          women: assignRanks(womenEntries),
          men: assignRanks(menEntries),
          noGender: assignRanks(noGenderEntries),
        };
      })
    );

    // Filter out categories where all gender groups are empty
    const nonEmpty = categories.filter(
      (c) => c.women.length > 0 || c.men.length > 0 || c.noGender.length > 0
    );

    // Sort alphabetically, "Other" last
    nonEmpty.sort((a, b) => {
      if (a.category.id === "uncategorized") return 1;
      if (b.category.id === "uncategorized") return -1;
      return a.category.name.localeCompare(b.category.name);
    });

    return { categories: nonEmpty };
  },
});

/**
 * Get weekly category leaderboard for a challenge.
 * Returns top users per category for a specific week number.
 * Uses the challengeLoggedDate index for efficient date-range filtering.
 */
export const getWeeklyCategoryLeaderboard = query({
  args: {
    challengeId: v.id("challenges"),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    const totalWeeks = getTotalWeeks(challenge.durationDays);
    const currentWeek = getChallengeWeekNumber(challenge.startDate, Date.now());

    // Clamp weekNumber to valid range
    const weekNumber = Math.max(1, Math.min(args.weekNumber, totalWeeks));
    const { start, end } = getWeekDateRange(challenge.startDate, weekNumber);

    // Fetch activity types for this challenge to build categoryId mapping
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const activityTypeMap = new Map(
      activityTypes.map((at) => [at._id, at])
    );

    // Collect unique category IDs and fetch category docs
    const categoryIds = new Set<Id<"categories">>();
    for (const at of activityTypes) {
      if (at.categoryId) categoryIds.add(at.categoryId);
    }
    const categoryDocs = await Promise.all(
      Array.from(categoryIds).map((id) => ctx.db.get(id))
    );
    const categoryMap = new Map(
      categoryDocs
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    );

    // Query activities for this challenge in the week date range
    // Uses challengeLoggedDate index: ["challengeId", "loggedDate"]
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeLoggedDate", (q) =>
        q
          .eq("challengeId", args.challengeId)
          .gte("loggedDate", start)
          .lt("loggedDate", end)
      )
      .filter(notDeleted)
      .collect();

    // Group points: categoryId -> userId -> totalPoints
    const categoryUserPoints = new Map<string, Map<string, number>>();

    for (const activity of activities) {
      const at = activityTypeMap.get(activity.activityTypeId);
      if (!at) continue;

      const catId = at.categoryId ?? "uncategorized";
      const catKey = catId as string;

      if (!categoryUserPoints.has(catKey)) {
        categoryUserPoints.set(catKey, new Map());
      }
      const userPoints = categoryUserPoints.get(catKey)!;
      const current = userPoints.get(activity.userId) ?? 0;
      userPoints.set(activity.userId, current + activity.pointsEarned);
    }

    // Build leaderboard per category: sort users, take top 10, fetch user data
    const userCache = new Map<string, { id: string; name: string | null; username: string; avatarUrl: string | null } | null>();

    const categories = await Promise.all(
      Array.from(categoryUserPoints.entries()).map(async ([catKey, userPointsMap]) => {
        // Sort users by points descending
        const sorted = Array.from(userPointsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        // Fetch user data (with caching)
        const entries = await Promise.all(
          sorted.map(async ([userId, points], index) => {
            if (!userCache.has(userId)) {
              const user = await ctx.db.get(userId as Id<"users">);
              userCache.set(
                userId,
                user
                  ? {
                      id: user._id,
                      name: user.name ?? null,
                      username: user.username,
                      avatarUrl: user.avatarUrl ?? null,
                    }
                  : null
              );
            }
            const user = userCache.get(userId);
            if (!user) return null;

            return {
              rank: index + 1,
              user,
              weeklyPoints: points,
            };
          })
        );

        const category =
          catKey === "uncategorized"
            ? { id: "uncategorized" as string, name: "Other" }
            : categoryMap.has(catKey as Id<"categories">)
              ? { id: catKey, name: categoryMap.get(catKey as Id<"categories">)!.name }
              : { id: catKey, name: "Unknown" };

        return {
          category,
          entries: entries.filter(
            (e): e is NonNullable<typeof e> => e !== null
          ),
        };
      })
    );

    // Sort categories alphabetically, but put "Other" last
    categories.sort((a, b) => {
      if (a.category.id === "uncategorized") return 1;
      if (b.category.id === "uncategorized") return -1;
      return a.category.name.localeCompare(b.category.name);
    });

    return {
      weekNumber,
      totalWeeks,
      currentWeek,
      categories: categories.filter((c) => c.entries.length > 0),
    };
  },
});
