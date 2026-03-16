import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

/**
 * Get an OAuth app by client ID (internal — used by HTTP API).
 */
export const getAppByClientId = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthApps")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .first();
  },
});

/**
 * Get an authorization code record (internal).
 */
export const getAuthorizationCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthAuthorizationCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

/**
 * Look up an OAuth access token by hash (internal).
 * Returns the token record + user if valid.
 */
export const getAccessTokenByHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!token || token.revokedAt) return null;
    if (token.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(token.userId);
    if (!user) return null;

    return { token, user };
  },
});

/**
 * Look up a refresh token by hash (internal).
 */
export const getRefreshTokenByHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("oauthRefreshTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!token || token.revokedAt) return null;
    if (token.expiresAt < Date.now()) return null;

    return token;
  },
});

/**
 * List OAuth apps registered by the current user.
 */
export const listMyApps = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const apps = await ctx.db
      .query("oauthApps")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return apps
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a._id,
        name: a.name,
        description: a.description,
        iconUrl: a.iconUrl,
        clientId: a.clientId,
        clientSecretPrefix: a.clientSecretPrefix,
        redirectUris: a.redirectUris,
        scopes: a.scopes,
        homepage: a.homepage,
        createdAt: a.createdAt,
      }));
  },
});

/**
 * List OAuth apps for a user (internal — called from HTTP API).
 */
export const listAppsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("oauthApps")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return apps
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a._id,
        name: a.name,
        description: a.description,
        iconUrl: a.iconUrl,
        clientId: a.clientId,
        clientSecretPrefix: a.clientSecretPrefix,
        redirectUris: a.redirectUris,
        scopes: a.scopes,
        homepage: a.homepage,
        createdAt: a.createdAt,
      }));
  },
});

/**
 * Get a single OAuth app by ID (internal).
 */
export const getAppById = internalQuery({
  args: { appId: v.id("oauthApps") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.appId);
  },
});
