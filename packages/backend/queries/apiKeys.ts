import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * List API keys for the current user (masked).
 */
export const listKeys = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();

    return keys
      .filter((k) => !k.revokedAt)
      .map((k) => ({
        id: k._id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        rawKey: k.rawKey ?? null,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Internal query: look up a user by API key hash.
 * Returns the user and key doc if valid, null otherwise.
 */
export const getUserByKeyHash = internalQuery({
  args: {
    keyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (!key || key.revokedAt) {
      return null;
    }

    const user = await ctx.db.get(key.userId);
    if (!user) {
      return null;
    }

    return { user, keyId: key._id };
  },
});
