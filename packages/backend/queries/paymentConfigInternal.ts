import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get payment config for webhook processing
 * This returns the encrypted keys which should only be used server-side
 */
export const getConfigForWebhook = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!config) {
      return null;
    }

    return {
      testMode: config.testMode,
      stripeWebhookSecret: config.stripeWebhookSecret,
      stripeTestWebhookSecret: config.stripeTestWebhookSecret,
    };
  },
});

/**
 * Internal query to get payment config with secret keys for testing connection
 */
export const getConfigWithSecretKeys = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!config) {
      return null;
    }

    return {
      testMode: config.testMode,
      stripeSecretKey: config.stripeSecretKey,
      stripeTestSecretKey: config.stripeTestSecretKey,
    };
  },
});

/**
 * Internal query to check if user is a challenge admin
 * Looks up user by email (linked to Better Auth)
 */
export const checkChallengeAdmin = internalQuery({
  args: {
    email: v.string(),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return { isAdmin: false, error: "User not found" };
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return { isAdmin: false, error: "Challenge not found" };
    }

    // Check if global admin or challenge creator
    const isGlobalAdmin = user.role === "admin";
    const isCreator = challenge.creatorId === user._id;

    // Check challenge-specific admin role
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();
    const isChallengeAdmin = participation?.role === "admin";

    return {
      isAdmin: isGlobalAdmin || isCreator || isChallengeAdmin,
      error: null,
    };
  },
});
