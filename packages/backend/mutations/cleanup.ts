import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * List challenges that have a description (seed data)
 */
export const listSeedChallenges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db
      .query("challenges")
      .filter((q) => q.neq(q.field("description"), undefined))
      .collect();

    return challenges.map((c) => ({
      id: c._id,
      name: c.name,
      description: c.description,
    }));
  },
});

/**
 * Delete a batch of activities for a challenge
 */
export const deleteActivitiesBatch = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .take(args.batchSize);

    for (const activity of activities) {
      // Delete likes for this activity
      const likes = await ctx.db
        .query("likes")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      for (const like of likes) {
        await ctx.db.delete(like._id);
      }

      // Delete comments for this activity
      const comments = await ctx.db
        .query("comments")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }

      await ctx.db.delete(activity._id);
    }

    return {
      deleted: activities.length,
      hasMore: activities.length === args.batchSize,
    };
  },
});

/**
 * Delete challenge and its non-activity data (after activities are deleted)
 */
export const deleteChallengeAfterActivities = internalMutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return { success: false, error: "Challenge not found" };
    }

    const deleted: Record<string, number> = {};

    // Delete activityTypes for this challenge
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    for (const at of activityTypes) {
      await ctx.db.delete(at._id);
    }
    deleted.activityTypes = activityTypes.length;

    // Delete userChallenges (participations) for this challenge
    const userChallenges = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    for (const uc of userChallenges) {
      await ctx.db.delete(uc._id);
    }
    deleted.userChallenges = userChallenges.length;

    // Delete the challenge itself
    await ctx.db.delete(args.challengeId);
    deleted.challenge = 1;

    return { success: true, deleted };
  },
});
