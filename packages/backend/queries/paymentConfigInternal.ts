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
 * Internal query to get data needed for verifying a checkout session.
 * Looks up the payment record by session ID to find the userId,
 * and fetches the payment config for Stripe keys.
 */
export const getVerifyData = internalQuery({
  args: {
    challengeId: v.id("challenges"),
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const paymentRecord = await ctx.db
      .query("paymentRecords")
      .withIndex("stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first();

    if (!paymentRecord) {
      return { error: "Payment record not found" } as const;
    }

    if (paymentRecord.status === "completed") {
      return { error: null, userId: paymentRecord.userId, alreadyCompleted: true, config: null } as const;
    }

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!paymentConfig) {
      return { error: "Payment not configured" } as const;
    }

    return {
      error: null,
      userId: paymentRecord.userId,
      alreadyCompleted: false,
      config: {
        testMode: paymentConfig.testMode,
        stripeSecretKey: paymentConfig.stripeSecretKey,
        stripeTestSecretKey: paymentConfig.stripeTestSecretKey,
      },
    };
  },
});

/**
 * Internal query to check if user is a challenge admin
 * Looks up user by email (linked to Better Auth)
 */
/**
 * Internal query to get all data needed for creating a checkout session.
 * Used by the createCheckoutSession and verifyCheckoutSession actions.
 */
export const getCheckoutData = internalQuery({
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
      return { error: "User not found" } as const;
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return { error: "Challenge not found" } as const;
    }

    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (participation?.paymentStatus === "paid") {
      return { error: "Already paid for this challenge" } as const;
    }

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!paymentConfig) {
      return { error: "Payment not configured for this challenge" } as const;
    }

    if (paymentConfig.priceInCents <= 0) {
      return { error: "Challenge is free - no payment required" } as const;
    }

    return {
      error: null,
      userId: user._id,
      challengeName: challenge.name,
      challengeDescription: challenge.description,
      config: {
        testMode: paymentConfig.testMode,
        priceInCents: paymentConfig.priceInCents,
        currency: paymentConfig.currency,
        allowCustomAmount: paymentConfig.allowCustomAmount ?? false,
        stripeSecretKey: paymentConfig.stripeSecretKey,
        stripeTestSecretKey: paymentConfig.stripeTestSecretKey,
      },
    };
  },
});

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
