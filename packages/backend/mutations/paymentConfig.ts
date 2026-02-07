import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { encryptKey } from "../lib/stripe";
import { getCurrentUser } from "../lib/ids";

// Helper to check if user is challenge admin
async function requireChallengeAdmin(
  ctx: { db: any; auth: any },
  challengeId: Id<"challenges">
) {
  const user = await getCurrentUser(ctx as any);
  if (!user) {
    throw new Error("Not authenticated");
  }

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  // Check if global admin or challenge creator
  const isGlobalAdmin = user.role === "admin";
  const isCreator = challenge.creatorId === user._id;

  // Check challenge-specific admin role
  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", user._id).eq("challengeId", challengeId)
    )
    .first();
  const isChallengeAdmin = participation?.role === "admin";

  if (!isGlobalAdmin && !isCreator && !isChallengeAdmin) {
    throw new Error("Not authorized - challenge admin required");
  }

  return { user, challenge };
}

/**
 * Save or update payment configuration for a challenge
 */
export const savePaymentConfig = mutation({
  args: {
    challengeId: v.id("challenges"),
    stripeSecretKey: v.optional(v.string()),
    stripePublishableKey: v.optional(v.string()),
    stripeTestSecretKey: v.optional(v.string()),
    stripeTestPublishableKey: v.optional(v.string()),
    stripeWebhookSecret: v.optional(v.string()),
    stripeTestWebhookSecret: v.optional(v.string()),
    testMode: v.boolean(),
    priceInCents: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const now = Date.now();

    // Check if config already exists
    const existingConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    // Prepare the data - encrypt secret keys
    const configData = {
      challengeId: args.challengeId,
      testMode: args.testMode,
      priceInCents: args.priceInCents,
      currency: args.currency || "usd",
      updatedAt: now,
      stripeSecretKey: args.stripeSecretKey ? encryptKey(args.stripeSecretKey) : undefined,
      stripePublishableKey: args.stripePublishableKey,
      stripeTestSecretKey: args.stripeTestSecretKey ? encryptKey(args.stripeTestSecretKey) : undefined,
      stripeTestPublishableKey: args.stripeTestPublishableKey,
      stripeWebhookSecret: args.stripeWebhookSecret ? encryptKey(args.stripeWebhookSecret) : undefined,
      stripeTestWebhookSecret: args.stripeTestWebhookSecret ? encryptKey(args.stripeTestWebhookSecret) : undefined,
    };

    if (existingConfig) {
      // Update existing config - only include defined values
      const patchData: Record<string, any> = {
        testMode: configData.testMode,
        priceInCents: configData.priceInCents,
        currency: configData.currency,
        updatedAt: configData.updatedAt,
      };
      if (configData.stripeSecretKey) patchData.stripeSecretKey = configData.stripeSecretKey;
      if (configData.stripePublishableKey) patchData.stripePublishableKey = configData.stripePublishableKey;
      if (configData.stripeTestSecretKey) patchData.stripeTestSecretKey = configData.stripeTestSecretKey;
      if (configData.stripeTestPublishableKey) patchData.stripeTestPublishableKey = configData.stripeTestPublishableKey;
      if (configData.stripeWebhookSecret) patchData.stripeWebhookSecret = configData.stripeWebhookSecret;
      if (configData.stripeTestWebhookSecret) patchData.stripeTestWebhookSecret = configData.stripeTestWebhookSecret;

      await ctx.db.patch(existingConfig._id, patchData);
      return { configId: existingConfig._id, updated: true };
    } else {
      // Create new config
      const configId = await ctx.db.insert("challengePaymentConfig", {
        ...configData,
        createdAt: now,
      });
      return { configId, updated: false };
    }
  },
});

/**
 * Toggle test mode for a challenge
 */
export const toggleTestMode = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!config) {
      throw new Error("Payment config not found");
    }

    await ctx.db.patch(config._id, {
      testMode: !config.testMode,
      updatedAt: Date.now(),
    });

    return { testMode: !config.testMode };
  },
});

/**
 * Delete payment configuration for a challenge
 */
export const deletePaymentConfig = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!config) {
      throw new Error("Payment config not found");
    }

    await ctx.db.delete(config._id);

    return { success: true };
  },
});
