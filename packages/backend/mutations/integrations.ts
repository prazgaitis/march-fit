import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Connect a Strava integration with full token data
 * Called from the OAuth callback after token exchange
 */
export const connectStrava = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    athleteId: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if integration already exists
    const existing = await ctx.db
      .query("userIntegrations")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("service"), "strava"))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        athleteId: args.athleteId,
        updatedAt: now,
        revoked: false,
      });
      return existing._id;
    } else {
      const integrationId = await ctx.db.insert("userIntegrations", {
        userId: user._id,
        service: "strava",
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        athleteId: args.athleteId,
        createdAt: now,
        updatedAt: now,
        revoked: false,
      });
      return integrationId;
    }
  },
});

/**
 * Update tokens after a refresh (internal, called from actions)
 */
export const updateStravaTokens = internalMutation({
  args: {
    integrationId: v.id("userIntegrations"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Legacy connect mutation - kept for backward compatibility
 */
export const connect = mutation({
  args: {
    service: v.union(v.literal("strava"), v.literal("apple_health")),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if integration already exists, if so update it
    const existing = await ctx.db
      .query("userIntegrations")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("service"), args.service))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.code,
        updatedAt: now,
        revoked: false,
      });
      return await ctx.db.get(existing._id);
    } else {
      const integrationId = await ctx.db.insert("userIntegrations", {
        userId: user._id,
        service: args.service,
        accessToken: args.code,
        createdAt: now,
        updatedAt: now,
        revoked: false,
      });
      return await ctx.db.get(integrationId);
    }
  },
});

export const disconnect = mutation({
  args: {
    integrationId: v.id("userIntegrations"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const integration = await ctx.db.get(args.integrationId);
    if (!integration) {
      throw new Error("Integration not found");
    }

    if (integration.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.integrationId);
  },
});



