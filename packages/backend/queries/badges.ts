import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all badge definitions for a challenge.
 * Includes the linked achievement name if set.
 */
export const getByChallengeId = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const badges = await ctx.db
      .query("badges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    return await Promise.all(
      badges.map(async (badge) => {
        let achievementName: string | null = null;
        if (badge.achievementId) {
          const achievement = await ctx.db.get(badge.achievementId);
          achievementName = achievement?.name ?? null;
        }
        return { ...badge, achievementName };
      })
    );
  },
});

/**
 * Get all badges for a user in a challenge, sorted by most recently awarded.
 */
export const getUserBadges = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter to this challenge and sort by awardedAt desc
    const filtered = userBadges
      .filter((ub) => ub.challengeId === args.challengeId)
      .sort((a, b) => b.awardedAt - a.awardedAt);

    return await Promise.all(
      filtered.map(async (ub) => {
        const badge = await ctx.db.get(ub.badgeId);
        if (!badge) return null;
        return {
          userBadgeId: ub._id,
          badgeId: badge._id,
          name: badge.name,
          description: badge.description ?? null,
          imagePublicId: badge.imagePublicId ?? null,
          icon: badge.icon ?? null,
          awardedAt: ub.awardedAt,
        };
      })
    );
  },
});

/**
 * Get all awarded badges for a challenge (admin view).
 * Returns each award with user info and badge details.
 */
export const getAwardedByChallenge = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const results = await Promise.all(
      userBadges.map(async (ub) => {
        const [badge, user] = await Promise.all([
          ctx.db.get(ub.badgeId),
          ctx.db.get(ub.userId),
        ]);
        if (!badge || !user) return null;
        return {
          userBadgeId: ub._id,
          badgeName: badge.name,
          imagePublicId: badge.imagePublicId ?? null,
          icon: badge.icon ?? null,
          userName: user.name ?? user.username ?? "Unknown",
          userId: user._id,
          avatarUrl: user.avatarUrl,
          awardedAt: ub.awardedAt,
        };
      })
    );

    return results
      .filter(Boolean)
      .sort((a, b) => b!.awardedAt - a!.awardedAt);
  },
});
