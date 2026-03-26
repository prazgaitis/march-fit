import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Create a new badge definition
 */
export const createBadge = mutation({
  args: {
    challengeId: v.id("challenges"),
    name: v.string(),
    description: v.optional(v.string()),
    imagePublicId: v.optional(v.string()),
    icon: v.optional(v.string()),
    achievementId: v.optional(v.id("achievements")),
  },
  handler: async (ctx, args) => {
    // If linking to an achievement, verify it belongs to the same challenge
    if (args.achievementId) {
      const achievement = await ctx.db.get(args.achievementId);
      if (!achievement || achievement.challengeId !== args.challengeId) {
        throw new Error("Achievement not found or belongs to a different challenge");
      }
    }

    const now = Date.now();
    return await ctx.db.insert("badges", {
      challengeId: args.challengeId,
      name: args.name,
      description: args.description,
      imagePublicId: args.imagePublicId,
      icon: args.icon,
      achievementId: args.achievementId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a badge definition
 */
export const updateBadge = mutation({
  args: {
    badgeId: v.id("badges"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imagePublicId: v.optional(v.string()),
    icon: v.optional(v.string()),
    achievementId: v.optional(v.id("achievements")),
    clearAchievementId: v.optional(v.boolean()),
    clearImagePublicId: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const badge = await ctx.db.get(args.badgeId);
    if (!badge) throw new Error("Badge not found");

    const updateData: Record<string, any> = { updatedAt: Date.now() };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.icon !== undefined) updateData.icon = args.icon;

    if (args.clearImagePublicId) {
      updateData.imagePublicId = undefined;
    } else if (args.imagePublicId !== undefined) {
      updateData.imagePublicId = args.imagePublicId;
    }

    if (args.clearAchievementId) {
      updateData.achievementId = undefined;
    } else if (args.achievementId !== undefined) {
      const achievement = await ctx.db.get(args.achievementId);
      if (!achievement || achievement.challengeId !== badge.challengeId) {
        throw new Error("Achievement not found or belongs to a different challenge");
      }
      updateData.achievementId = args.achievementId;
    }

    await ctx.db.patch(args.badgeId, updateData);
    return { success: true };
  },
});

/**
 * Delete a badge and all associated userBadges
 */
export const deleteBadge = mutation({
  args: {
    badgeId: v.id("badges"),
  },
  handler: async (ctx, args) => {
    const badge = await ctx.db.get(args.badgeId);
    if (!badge) throw new Error("Badge not found");

    // Cascade delete userBadges
    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("badgeId", (q) => q.eq("badgeId", args.badgeId))
      .collect();

    for (const ub of userBadges) {
      await ctx.db.delete(ub._id);
    }

    await ctx.db.delete(args.badgeId);
    return { success: true };
  },
});

/**
 * Award a badge to a user (admin action)
 */
export const awardBadge = mutation({
  args: {
    badgeId: v.id("badges"),
    userId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const badge = await ctx.db.get(args.badgeId);
    if (!badge) throw new Error("Badge not found");
    if (badge.challengeId !== args.challengeId) {
      throw new Error("Badge does not belong to this challenge");
    }

    // Check for existing award (deduplicate)
    const existing = await ctx.db
      .query("userBadges")
      .withIndex("userBadge", (q) =>
        q.eq("userId", args.userId).eq("badgeId", args.badgeId)
      )
      .first();

    if (existing) {
      throw new Error("User already has this badge");
    }

    // Get the current user (admin) from auth
    const identity = await ctx.auth.getUserIdentity();
    let awardedBy: any = undefined;
    if (identity) {
      const adminUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", identity.email!))
        .first();
      if (adminUser) awardedBy = adminUser._id;
    }

    return await ctx.db.insert("userBadges", {
      challengeId: args.challengeId,
      userId: args.userId,
      badgeId: args.badgeId,
      awardedAt: Date.now(),
      awardedBy,
    });
  },
});

/**
 * Remove a badge from a user (admin action)
 */
export const removeBadge = mutation({
  args: {
    userBadgeId: v.id("userBadges"),
  },
  handler: async (ctx, args) => {
    const userBadge = await ctx.db.get(args.userBadgeId);
    if (!userBadge) throw new Error("User badge not found");

    await ctx.db.delete(args.userBadgeId);
    return { success: true };
  },
});
