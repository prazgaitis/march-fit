import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getChallengeWeekNumber, getTotalWeeks, isInFinalDays } from "../lib/weeks";
import { getCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";

// Internal query for looking up a single activity type by ID
export const getByIdInternal = internalQuery({
  args: {
    activityTypeId: v.id("activityTypes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.activityTypeId);
  },
});

// Internal query for seeding
export const listByChallenge = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
  },
});

/**
 * Get activity types for a challenge, sorted by displayOrder ascending.
 * Activities without a displayOrder sort after those with one, then by creation time.
 */
export const getByChallengeId = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const types = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    return types.sort((a, b) => {
      const aOrder = a.displayOrder ?? 9999;
      const bOrder = b.displayOrder ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a._creationTime - b._creationTime;
    });
  },
});

/**
 * Get activity types visible to participants right now in the logging menu.
 *
 * Visibility rules:
 *  - No validWeeks → always visible
 *  - validWeeks set, current week matches → visible
 *  - validWeeks set, doesn't match, but availableInFinalDays && we're in Final Days → visible
 *  - Otherwise → hidden
 *
 * Results are sorted by displayOrder (nulls last), then creation time.
 */
export const getVisibleByChallengeId = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return [];

    const now = Date.now();
    const currentWeek = getChallengeWeekNumber(challenge.startDate, now);
    const finalDays = isInFinalDays(challenge, now);

    const types = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    return types
      .filter((type) => {
        if (!type.validWeeks || type.validWeeks.length === 0) return true;
        if (type.validWeeks.includes(currentWeek)) return true;
        if (type.availableInFinalDays && finalDays) return true;
        return false;
      })
      .sort((a, b) => {
        const aOrder = a.displayOrder ?? 9999;
        const bOrder = b.displayOrder ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a._creationTime - b._creationTime;
      });
  },
});

/**
 * Get activity type availability for the current user in a challenge.
 * Returns ALL activity types enriched with availability and usage info,
 * plus category data and specials tracking (3/week, 6/challenge per type).
 */
export const getAvailabilityForUser = query({
  args: {
    challengeId: v.id("challenges"),
    todayDateMs: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    const now = Date.now();
    const currentWeek = getChallengeWeekNumber(challenge.startDate, now);
    const totalWeeks = getTotalWeeks(challenge.durationDays);
    const finalDays = isInFinalDays(challenge, now);

    const types = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Fetch categories for grouping
    const categoryIds = new Set(
      types.map((t) => t.categoryId).filter((id): id is NonNullable<typeof id> => id != null)
    );
    const categories = await Promise.all(
      Array.from(categoryIds).map((id) => ctx.db.get(id))
    );
    const categoryMap: Record<
      string,
      { _id: string; name: string; sortOrder?: number }
    > = {};
    for (const cat of categories) {
      if (cat) categoryMap[cat._id] = { _id: cat._id, name: cat.name, sortOrder: cat.sortOrder };
    }

    // Identify the "Special" category by name
    const specialsCategoryId = Object.values(categoryMap).find(
      (c) => c.name.toLowerCase() === "special"
    )?._id;

    // Fetch all user activities for this challenge to compute usage counts
    const allUserActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_challenge_date", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .filter(notDeleted)
      .collect();

    // Build a set of streak-contributing type IDs
    const streakTypeIds = new Set(
      types.filter((t) => t.contributesToStreak).map((t) => t._id)
    );

    // Count per-type usage (challenge total)
    const challengeUsageByType = new Map<string, number>();
    // Count per-type usage this week
    const weekUsageByType = new Map<string, number>();
    // Count total specials this week (across all special types)
    let specialsUsedThisWeek = 0;
    // Sum streak-eligible points for today
    let todayStreakPoints = 0;

    const specialTypeIds = new Set(
      types
        .filter((t) => t.categoryId === specialsCategoryId)
        .map((t) => t._id)
    );

    for (const activity of allUserActivities) {
      const typeId = activity.activityTypeId;
      challengeUsageByType.set(
        typeId,
        (challengeUsageByType.get(typeId) ?? 0) + 1
      );

      const activityWeek = getChallengeWeekNumber(
        challenge.startDate,
        activity.loggedDate
      );
      if (activityWeek === currentWeek) {
        weekUsageByType.set(typeId, (weekUsageByType.get(typeId) ?? 0) + 1);
        if (specialTypeIds.has(typeId)) {
          specialsUsedThisWeek++;
        }
      }

      if (
        activity.loggedDate === args.todayDateMs &&
        streakTypeIds.has(typeId)
      ) {
        todayStreakPoints += activity.pointsEarned;
      }
    }

    const sorted = types.sort((a, b) => {
      const aOrder = a.displayOrder ?? 9999;
      const bOrder = b.displayOrder ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a._creationTime - b._creationTime;
    });

    const enriched = sorted.map((type) => {
      const hasWeekRestriction =
        type.validWeeks != null && type.validWeeks.length > 0;
      const availableThisWeek = hasWeekRestriction
        ? type.validWeeks!.includes(currentWeek) ||
          (type.availableInFinalDays === true && finalDays)
        : true;

      const isSpecial = type.categoryId === specialsCategoryId;
      const challengeUsed = challengeUsageByType.get(type._id) ?? 0;
      const weekUsed = weekUsageByType.get(type._id) ?? 0;

      // maxPerChallenge from type config, or 6 for specials (per-type monthly limit)
      const effectiveMaxPerChallenge = type.maxPerChallenge ?? (isSpecial ? 6 : undefined);
      const isMaxedOut =
        effectiveMaxPerChallenge != null && challengeUsed >= effectiveMaxPerChallenge;

      return {
        ...type,
        availableThisWeek,
        challengeUsed,
        weekUsed,
        isSpecial,
        effectiveMaxPerChallenge,
        isMaxedOut,
      };
    });

    return {
      activityTypes: enriched,
      categories: categoryMap,
      currentWeek,
      totalWeeks,
      specialsUsedThisWeek,
      specialsPerWeekLimit: 3,
      todayStreakPoints,
      streakMinPoints: challenge.streakMinPoints,
    };
  },
});
