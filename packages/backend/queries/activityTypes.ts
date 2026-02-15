import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

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
 * Get activity types for a challenge
 */
export const getByChallengeId = query({
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
