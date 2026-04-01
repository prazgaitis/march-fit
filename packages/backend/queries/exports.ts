import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { notDeleted } from "../lib/activityFilters";

/**
 * List exports for a challenge (admin only).
 */
export const listByChallenge = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const exports = await ctx.db
      .query("exports")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Enrich with requester info and download URLs
    const enriched = await Promise.all(
      exports.map(async (exp) => {
        const requester = await ctx.db.get(exp.requestedById);
        let downloadUrl: string | null = null;
        if (exp.storageId) {
          downloadUrl = await ctx.storage.getUrl(exp.storageId);
        }
        return {
          ...exp,
          _id: exp._id as string,
          requesterName: requester?.name ?? requester?.username ?? "Unknown",
          downloadUrl,
        };
      }),
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Internal query: fetch a page of activities for CSV export.
 * Uses cursor-based pagination on the challengeId index.
 */
export const getActivitiesPage = internalQuery({
  args: {
    challengeId: v.id("challenges"),
    cursor: v.optional(v.string()),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter(notDeleted)
      .paginate({ numItems: args.pageSize, cursor: args.cursor === undefined ? null : args.cursor as any });

    return {
      page: result.page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Internal query: get all activity types for a challenge (for CSV enrichment).
 */
export const getActivityTypesForChallenge = internalQuery({
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
 * Internal query: get all participants for a challenge (for CSV enrichment).
 */
export const getUsersForChallenge = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const users = await Promise.all(
      participations.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return user
          ? { _id: user._id, name: user.name, username: user.username, email: user.email }
          : null;
      }),
    );

    return users.filter((u) => u !== null);
  },
});

/**
 * Internal query: get all categories (for CSV enrichment).
 */
export const getAllCategories = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

/**
 * Internal query: get a single export by ID.
 */
export const getById = internalQuery({
  args: {
    exportId: v.id("exports"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.exportId);
  },
});
