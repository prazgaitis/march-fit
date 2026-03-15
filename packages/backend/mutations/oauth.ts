import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import {
  generateClientId,
  generateClientSecret,
  generateAuthCode,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyPkceS256,
  validateScopes,
  scopesAreSubset,
  AUTH_CODE_TTL_MS,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  VALID_SCOPES,
} from "../lib/oauth";

// ─── App Registration ──────────────────────────────────────────────────────

/**
 * Register a new OAuth app. Returns clientId + raw client secret (shown once).
 */
export const createApp = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    scopes: v.array(v.string()),
    homepage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Validate scopes
    if (!validateScopes(args.scopes)) {
      throw new Error(
        `Invalid scopes. Valid scopes: ${VALID_SCOPES.join(", ")}`
      );
    }

    // Validate redirect URIs
    for (const uri of args.redirectUris) {
      try {
        new URL(uri);
      } catch {
        throw new Error(`Invalid redirect URI: ${uri}`);
      }
    }

    // Limit apps per user
    const existing = await ctx.db
      .query("oauthApps")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const active = existing.filter((a) => a.isActive);
    if (active.length >= 10) {
      throw new Error("Maximum of 10 active OAuth apps per user");
    }

    const clientId = generateClientId();
    const { raw: clientSecretRaw, hash: clientSecretHash, prefix: clientSecretPrefix } =
      await generateClientSecret();

    const now = Date.now();
    const appId = await ctx.db.insert("oauthApps", {
      userId: user._id,
      name: args.name,
      description: args.description,
      iconUrl: args.iconUrl,
      clientId,
      clientSecretHash,
      clientSecretPrefix,
      redirectUris: args.redirectUris,
      scopes: args.scopes,
      homepage: args.homepage,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      appId,
      clientId,
      clientSecret: clientSecretRaw,
      clientSecretPrefix,
    };
  },
});

/**
 * Update an OAuth app's settings.
 */
export const updateApp = mutation({
  args: {
    appId: v.id("oauthApps"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    redirectUris: v.optional(v.array(v.string())),
    scopes: v.optional(v.array(v.string())),
    homepage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const app = await ctx.db.get(args.appId);
    if (!app || app.userId !== user._id) {
      throw new Error("App not found");
    }

    if (args.scopes && !validateScopes(args.scopes)) {
      throw new Error(
        `Invalid scopes. Valid scopes: ${VALID_SCOPES.join(", ")}`
      );
    }

    if (args.redirectUris) {
      for (const uri of args.redirectUris) {
        try {
          new URL(uri);
        } catch {
          throw new Error(`Invalid redirect URI: ${uri}`);
        }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.iconUrl !== undefined) updates.iconUrl = args.iconUrl;
    if (args.redirectUris !== undefined) updates.redirectUris = args.redirectUris;
    if (args.scopes !== undefined) updates.scopes = args.scopes;
    if (args.homepage !== undefined) updates.homepage = args.homepage;

    await ctx.db.patch(args.appId, updates);
    return { success: true };
  },
});

/**
 * Deactivate an OAuth app (soft delete).
 */
export const deleteApp = mutation({
  args: { appId: v.id("oauthApps") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const app = await ctx.db.get(args.appId);
    if (!app || app.userId !== user._id) {
      throw new Error("App not found");
    }

    await ctx.db.patch(args.appId, { isActive: false, updatedAt: Date.now() });
    return { success: true };
  },
});

/**
 * Rotate the client secret for an OAuth app.
 */
export const rotateSecret = mutation({
  args: { appId: v.id("oauthApps") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const app = await ctx.db.get(args.appId);
    if (!app || app.userId !== user._id) {
      throw new Error("App not found");
    }

    const { raw, hash, prefix } = await generateClientSecret();

    await ctx.db.patch(args.appId, {
      clientSecretHash: hash,
      clientSecretPrefix: prefix,
      updatedAt: Date.now(),
    });

    return { clientSecret: raw, clientSecretPrefix: prefix };
  },
});

// ─── Authorization Code (internal — called from HTTP actions) ──────────────

/**
 * Create an authorization code after user consents.
 */
export const createAuthorizationCode = internalMutation({
  args: {
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    scopes: v.array(v.string()),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { raw } = await generateAuthCode();
    const now = Date.now();

    await ctx.db.insert("oauthAuthorizationCodes", {
      code: raw,
      clientId: args.clientId,
      userId: args.userId,
      redirectUri: args.redirectUri,
      scopes: args.scopes,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      expiresAt: now + AUTH_CODE_TTL_MS,
      createdAt: now,
    });

    return { code: raw };
  },
});

/**
 * Mark an authorization code as used.
 */
export const markCodeUsed = internalMutation({
  args: { codeId: v.id("oauthAuthorizationCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codeId, { usedAt: Date.now() });
  },
});

// ─── Token Issuance (internal — called from HTTP actions) ──────────────────

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export const exchangeCodeForTokens = internalMutation({
  args: {
    codeId: v.id("oauthAuthorizationCodes"),
    clientId: v.string(),
    userId: v.id("users"),
    scopes: v.array(v.string()),
    codeVerifier: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // PKCE verification
    if (args.codeChallenge && args.codeChallengeMethod === "S256") {
      if (!args.codeVerifier) {
        throw new Error("code_verifier required for PKCE");
      }
      const valid = await verifyPkceS256(args.codeVerifier, args.codeChallenge);
      if (!valid) {
        throw new Error("Invalid code_verifier");
      }
    }

    // Mark code as used
    await ctx.db.patch(args.codeId, { usedAt: Date.now() });

    // Generate tokens
    const accessToken = await generateAccessToken();
    const refreshToken = await generateRefreshToken();
    const now = Date.now();

    await ctx.db.insert("oauthAccessTokens", {
      tokenHash: accessToken.hash,
      tokenPrefix: accessToken.prefix,
      clientId: args.clientId,
      userId: args.userId,
      scopes: args.scopes,
      expiresAt: now + ACCESS_TOKEN_TTL_MS,
      createdAt: now,
    });

    await ctx.db.insert("oauthRefreshTokens", {
      tokenHash: refreshToken.hash,
      tokenPrefix: refreshToken.prefix,
      clientId: args.clientId,
      userId: args.userId,
      scopes: args.scopes,
      expiresAt: now + REFRESH_TOKEN_TTL_MS,
      accessTokenHash: accessToken.hash,
      createdAt: now,
    });

    return {
      accessToken: accessToken.raw,
      refreshToken: refreshToken.raw,
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
      scopes: args.scopes,
    };
  },
});

/**
 * Refresh an access token using a refresh token.
 */
export const refreshAccessToken = internalMutation({
  args: {
    refreshTokenId: v.id("oauthRefreshTokens"),
    clientId: v.string(),
    userId: v.id("users"),
    scopes: v.array(v.string()),
    oldAccessTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Revoke the old access token
    const oldAccessToken = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.oldAccessTokenHash))
      .first();
    if (oldAccessToken && !oldAccessToken.revokedAt) {
      await ctx.db.patch(oldAccessToken._id, { revokedAt: Date.now() });
    }

    // Revoke the old refresh token
    await ctx.db.patch(args.refreshTokenId, { revokedAt: Date.now() });

    // Issue new tokens
    const accessToken = await generateAccessToken();
    const refreshToken = await generateRefreshToken();
    const now = Date.now();

    await ctx.db.insert("oauthAccessTokens", {
      tokenHash: accessToken.hash,
      tokenPrefix: accessToken.prefix,
      clientId: args.clientId,
      userId: args.userId,
      scopes: args.scopes,
      expiresAt: now + ACCESS_TOKEN_TTL_MS,
      createdAt: now,
    });

    await ctx.db.insert("oauthRefreshTokens", {
      tokenHash: refreshToken.hash,
      tokenPrefix: refreshToken.prefix,
      clientId: args.clientId,
      userId: args.userId,
      scopes: args.scopes,
      expiresAt: now + REFRESH_TOKEN_TTL_MS,
      accessTokenHash: accessToken.hash,
      createdAt: now,
    });

    return {
      accessToken: accessToken.raw,
      refreshToken: refreshToken.raw,
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
      scopes: args.scopes,
    };
  },
});

// ─── Token Revocation (internal) ───────────────────────────────────────────

/**
 * Revoke an access token (and its associated refresh token).
 */
export const revokeAccessToken = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (token && !token.revokedAt) {
      await ctx.db.patch(token._id, { revokedAt: Date.now() });
    }

    // Also revoke associated refresh tokens
    const refreshTokens = await ctx.db
      .query("oauthRefreshTokens")
      .withIndex("by_userId", (q) => q.eq("userId", token!.userId))
      .collect();
    for (const rt of refreshTokens) {
      if (rt.accessTokenHash === args.tokenHash && !rt.revokedAt) {
        await ctx.db.patch(rt._id, { revokedAt: Date.now() });
      }
    }
  },
});

/**
 * Revoke a refresh token.
 */
export const revokeRefreshToken = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("oauthRefreshTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (token && !token.revokedAt) {
      await ctx.db.patch(token._id, { revokedAt: Date.now() });
    }
  },
});
