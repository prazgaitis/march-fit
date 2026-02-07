import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Create or update an integration mapping
 */
export const upsert = mutation({
  args: {
    challengeId: v.id("challenges"),
    service: v.union(v.literal("strava"), v.literal("apple_health")),
    externalType: v.string(),
    activityTypeId: v.id("activityTypes"),
    metricMapping: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this challenge
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Check if user is admin or creator
    const isAdmin = user.role === "admin" || challenge.creatorId === user._id;
    if (!isAdmin) {
      // Check if user is a challenge admin
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", args.challengeId)
        )
        .first();

      if (!participation || participation.role !== "admin") {
        throw new Error("Not authorized to manage integration mappings");
      }
    }

    // Verify activity type belongs to this challenge
    const activityType = await ctx.db.get(args.activityTypeId);
    if (!activityType || activityType.challengeId !== args.challengeId) {
      throw new Error("Activity type not found or does not belong to this challenge");
    }

    // Check for existing mapping
    const existing = await ctx.db
      .query("integrationMappings")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter((q) =>
        q.and(
          q.eq(q.field("service"), args.service),
          q.eq(q.field("externalType"), args.externalType)
        )
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing mapping
      await ctx.db.patch(existing._id, {
        activityTypeId: args.activityTypeId,
        metricMapping: args.metricMapping,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new mapping
      return await ctx.db.insert("integrationMappings", {
        challengeId: args.challengeId,
        service: args.service,
        externalType: args.externalType,
        activityTypeId: args.activityTypeId,
        metricMapping: args.metricMapping,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Remove an integration mapping
 */
export const remove = mutation({
  args: {
    mappingId: v.id("integrationMappings"),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db.get(args.mappingId);
    if (!mapping) {
      throw new Error("Mapping not found");
    }

    // Verify user has access
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const challenge = await ctx.db.get(mapping.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Check if user is admin or creator
    const isAdmin = user.role === "admin" || challenge.creatorId === user._id;
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", user._id).eq("challengeId", mapping.challengeId)
        )
        .first();

      if (!participation || participation.role !== "admin") {
        throw new Error("Not authorized to manage integration mappings");
      }
    }

    await ctx.db.delete(args.mappingId);
    return { deleted: true };
  },
});
