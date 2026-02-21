import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getChallengeWeekNumber, isInFinalDays } from "../lib/weeks";

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
