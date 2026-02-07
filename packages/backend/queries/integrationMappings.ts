import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List all integration mappings for a challenge
 */
export const listByChallenge = query({
  args: {
    challengeId: v.id("challenges"),
    service: v.optional(v.union(v.literal("strava"), v.literal("apple_health"))),
  },
  handler: async (ctx, args) => {
    let mappings = await ctx.db
      .query("integrationMappings")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    if (args.service) {
      mappings = mappings.filter((m) => m.service === args.service);
    }

    // Fetch activity type names for each mapping
    const result = await Promise.all(
      mappings.map(async (mapping) => {
        const activityType = await ctx.db.get(mapping.activityTypeId);
        return {
          ...mapping,
          activityTypeName: activityType?.name ?? "Unknown",
        };
      })
    );

    return result;
  },
});

/**
 * Get a specific mapping by external type
 */
export const getByExternalType = query({
  args: {
    challengeId: v.id("challenges"),
    service: v.union(v.literal("strava"), v.literal("apple_health")),
    externalType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationMappings")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter((q) =>
        q.and(
          q.eq(q.field("service"), args.service),
          q.eq(q.field("externalType"), args.externalType)
        )
      )
      .first();
  },
});
