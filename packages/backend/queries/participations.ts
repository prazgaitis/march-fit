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
        .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints),
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

    // Sort by denormalized totalPoints descending
    const sorted = [...participations].sort(
      (a, b) => b.totalPoints - a.totalPoints
    );

    const limit = args.paginationOpts.numItems;
    const cursorIndex = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const paginatedItems = sorted.slice(cursorIndex, cursorIndex + limit);

    const isDone = cursorIndex + limit >= sorted.length;
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

    // Sort by denormalized totalPoints descending
    const sorted = [...participations].sort(
      (a, b) => b.totalPoints - a.totalPoints
    );

    // Batch fetch all users in parallel
    const entries = await Promise.all(
      sorted.map(async (participation, index) => {
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

    // Fetch categories for this challenge and filter to leaderboard-eligible ones.
    // We no longer scan activities — reads are O(categories × participants).
    const allCategoryPoints = await ctx.db
      .query("categoryPoints")
      .withIndex("challengeCategory", (q) =>
        q.eq("challengeId", args.challengeId)
      )
      .collect();

    if (allCategoryPoints.length === 0) {
      return { categories: [] };
    }

    // Resolve category docs and filter to showInCategoryLeaderboard === true
    const uniqueCategoryIds = [
      ...new Set(allCategoryPoints.map((cp) => cp.categoryId as string)),
    ];
    const categoryDocs = await Promise.all(
      uniqueCategoryIds.map((id) => ctx.db.get(id as Id<"categories">))
    );
    const leaderboardCategoryMap = new Map(
      categoryDocs
        .filter(
          (c): c is NonNullable<typeof c> =>
            c !== null && c.showInCategoryLeaderboard === true
        )
        .map((c) => [c._id as string, c])
    );

    if (leaderboardCategoryMap.size === 0) {
      return { categories: [] };
    }

    // Group into categoryId → userId → totalPoints (only leaderboard categories)
    const categoryUserPoints = new Map<string, Map<string, number>>();
    for (const cp of allCategoryPoints) {
      const catKey = cp.categoryId as string;
      if (!leaderboardCategoryMap.has(catKey)) continue;
      if (!categoryUserPoints.has(catKey)) {
        categoryUserPoints.set(catKey, new Map());
      }
      categoryUserPoints.get(catKey)!.set(cp.userId as string, cp.totalPoints);
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
        // Men's/Open bucket: includes users with gender==="male" and users with no gender set
        const menEntries: Array<{ rank: number; user: NonNullable<typeof userCache extends Map<string, infer V> ? V : never>; totalPoints: number }> = [];

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
          } else {
            // gender === "male" or gender === null/undefined → Men's/Open
            menEntries.push({ rank: 0, user, totalPoints: points });
          }
        }

        // Assign ranks and take top 5 per gender group
        const assignRanks = <T extends { rank: number }>(arr: T[]): T[] =>
          arr.slice(0, 5).map((e, i) => ({ ...e, rank: i + 1 }));

        const catDoc = leaderboardCategoryMap.get(catKey);
        const category = catDoc
          ? { id: catKey, name: catDoc.name }
          : { id: catKey, name: "Unknown" };

        return {
          category,
          women: assignRanks(womenEntries),
          men: assignRanks(menEntries),
          noGender: [] as Array<{ rank: number; user: NonNullable<typeof userCache extends Map<string, infer V> ? V : never>; totalPoints: number }>,
        };
      })
    );

    // Filter out categories where all gender groups are empty, sort alphabetically
    return {
      categories: categories
        .filter((c) => c.women.length > 0 || c.men.length > 0)
        .sort((a, b) => a.category.name.localeCompare(b.category.name)),
    };
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

    // Only show categories flagged for the leaderboard
    const leaderboardCategoryIds = new Set<string>(
      Array.from(categoryMap.entries())
        .filter(([, cat]) => cat.showInCategoryLeaderboard === true)
        .map(([id]) => id as string)
    );

    // Query weekly activities for this challenge in the selected week date range.
    // Uses the challengeLoggedDate index for efficient date-range filtering —
    // avoids a full challenge scan and keeps reads well within Convex's limit.
    const weeklyActivities = await ctx.db
      .query("activities")
      .withIndex("challengeLoggedDate", (q) =>
        q
          .eq("challengeId", args.challengeId)
          .gte("loggedDate", start)
          .lt("loggedDate", end)
      )
      .filter(notDeleted)
      .collect();

    // Group weekly points: categoryId -> userId -> totalPoints.
    const weeklyCategoryUserPoints = new Map<string, Map<string, number>>();

    for (const activity of weeklyActivities) {
      const at = activityTypeMap.get(activity.activityTypeId);
      if (!at || !at.categoryId) continue;

      const categoryKey = at.categoryId as string;
      if (!leaderboardCategoryIds.has(categoryKey)) continue;

      if (!weeklyCategoryUserPoints.has(categoryKey)) {
        weeklyCategoryUserPoints.set(categoryKey, new Map());
      }
      const userPoints = weeklyCategoryUserPoints.get(categoryKey)!;
      userPoints.set(
        activity.userId as string,
        (userPoints.get(activity.userId as string) ?? 0) + activity.pointsEarned,
      );
    }

    // Build leaderboard per category: sort weekly users, take top 10, fetch user data.
    const userCache = new Map<string, { id: string; name: string | null; username: string; avatarUrl: string | null } | null>();
    const getUser = async (userId: string) => {
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
      return userCache.get(userId);
    };

    const categories = await Promise.all(
      Array.from(weeklyCategoryUserPoints.entries()).map(async ([catKey, userPointsMap]) => {
        // Sort users by weekly points descending, take top 10.
        const sorted = Array.from(userPointsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const entries = await Promise.all(
          sorted.map(async ([userId, points], index) => {
            const user = await getUser(userId);
            if (!user) return null;
            return { rank: index + 1, user, weeklyPoints: points };
          })
        );

        const catDoc = categoryMap.get(catKey as Id<"categories">);
        const category = catDoc
          ? { id: catKey, name: catDoc.name }
          : { id: catKey, name: "Unknown" };

        return {
          category,
          entries: entries.filter((e): e is NonNullable<typeof e> => e !== null),
        };
      })
    );

    // Sort categories alphabetically
    categories.sort((a, b) => {
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
