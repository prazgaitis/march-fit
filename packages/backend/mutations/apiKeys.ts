import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";
import { generateApiKey } from "../lib/apiKey";

/**
 * Create a new API key for the current user.
 * Returns the raw key (shown once, never stored).
 */
export const createKey = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Limit to 10 active keys per user
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    const activeKeys = existingKeys.filter((k) => !k.revokedAt);
    if (activeKeys.length >= 10) {
      throw new Error("Maximum of 10 active API keys per user");
    }

    const { rawKey, keyHash, keyPrefix } = await generateApiKey();

    await ctx.db.insert("apiKeys", {
      userId: user._id,
      keyHash,
      keyPrefix,
      name: args.name,
      createdAt: Date.now(),
    });

    return { rawKey, keyPrefix, name: args.name };
  },
});

/**
 * Revoke an API key.
 */
export const revokeKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    if (key.userId !== user._id) {
      throw new Error("Not authorized to revoke this key");
    }

    if (key.revokedAt) {
      return { success: true };
    }

    await ctx.db.patch(args.keyId, {
      revokedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update lastUsedAt for an API key (called from HTTP actions).
 */
export const touchLastUsed = internalMutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, {
      lastUsedAt: Date.now(),
    });
  },
});
