import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get integrations for a user
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userIntegrations")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Get Strava integration by athlete ID (internal, for webhook processing)
 */
export const getByAthleteId = internalQuery({
  args: {
    athleteId: v.number(),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("userIntegrations")
      .withIndex("athleteId", (q) => q.eq("athleteId", args.athleteId))
      .filter((q) => q.eq(q.field("service"), "strava"))
      .first();

    if (!integration) {
      return null;
    }

    // Also fetch the user
    const user = await ctx.db.get(integration.userId);
    if (!user) {
      return null;
    }

    return {
      integration,
      user,
    };
  },
});

/**
 * Get challenge participants who have Strava connected (for admin preview)
 */
export const getChallengeParticipantsWithStrava = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    // Get all participants in this challenge
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const results = [];

    for (const participation of participations) {
      // Check if this user has an active Strava integration
      const stravaIntegration = await ctx.db
        .query("userIntegrations")
        .withIndex("userId", (q) => q.eq("userId", participation.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("service"), "strava"),
            q.eq(q.field("revoked"), false)
          )
        )
        .first();

      if (stravaIntegration && stravaIntegration.accessToken) {
        const user = await ctx.db.get(participation.userId);
        if (user) {
          results.push({
            id: participation.userId,
            name: user.name || user.username,
            username: user.username,
            avatarUrl: user.avatarUrl,
            integration: {
              id: stravaIntegration._id,
              athleteId: stravaIntegration.athleteId,
              accessToken: stravaIntegration.accessToken,
              refreshToken: stravaIntegration.refreshToken,
              expiresAt: stravaIntegration.expiresAt,
            },
          });
        }
      }
    }

    return results;
  },
});



