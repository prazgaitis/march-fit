import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { maskKey } from "../lib/stripe";

/**
 * Get payment configuration for a challenge (admin view with masked keys)
 */
export const getPaymentConfig = query({
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

    // Return config with masked secret keys
    return {
      id: config._id,
      challengeId: config.challengeId,
      // Masked keys for display
      hasLiveSecretKey: !!config.stripeSecretKey,
      hasLivePublishableKey: !!config.stripePublishableKey,
      hasTestSecretKey: !!config.stripeTestSecretKey,
      hasTestPublishableKey: !!config.stripeTestPublishableKey,
      hasWebhookSecret: !!config.stripeWebhookSecret,
      hasTestWebhookSecret: !!config.stripeTestWebhookSecret,
      // Publishable keys can be shown (they're public)
      stripePublishableKey: config.stripePublishableKey || null,
      stripeTestPublishableKey: config.stripeTestPublishableKey || null,
      // Settings
      testMode: config.testMode,
      priceInCents: config.priceInCents,
      currency: config.currency,
      allowCustomAmount: config.allowCustomAmount ?? false,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  },
});

/**
 * Get public payment info for a challenge (for join page)
 */
export const getPublicPaymentInfo = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!config) {
      // No payment required
      return {
        requiresPayment: false,
        priceInCents: 0,
        currency: "usd",
        testMode: false,
      };
    }

    // Check if payment is properly configured
    const hasRequiredKeys = config.testMode
      ? config.stripeTestSecretKey && config.stripeTestPublishableKey
      : config.stripeSecretKey && config.stripePublishableKey;

    if (!hasRequiredKeys || config.priceInCents <= 0) {
      return {
        requiresPayment: false,
        priceInCents: 0,
        currency: "usd",
        testMode: config.testMode,
      };
    }

    return {
      requiresPayment: true,
      priceInCents: config.priceInCents,
      currency: config.currency,
      testMode: config.testMode,
      // Include publishable key for client-side Stripe
      stripePublishableKey: config.testMode
        ? config.stripeTestPublishableKey
        : config.stripePublishableKey,
    };
  },
});

/**
 * List all payments for a challenge (admin view)
 */
export const listPayments = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("paymentRecords")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by createdAt descending
    payments.sort((a, b) => b.createdAt - a.createdAt);

    // Get user info for each payment
    const paymentsWithUsers = await Promise.all(
      payments.map(async (payment) => {
        const user = await ctx.db.get(payment.userId);
        return {
          id: payment._id,
          ...payment,
          user: user
            ? {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
        };
      })
    );

    return paymentsWithUsers;
  },
});

/**
 * Get payment stats for a challenge
 */
export const getPaymentStats = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("paymentRecords")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const completed = payments.filter((p) => p.status === "completed");
    const pending = payments.filter((p) => p.status === "pending");
    const failed = payments.filter((p) => p.status === "failed");

    const totalRevenue = completed.reduce((sum, p) => sum + p.amountInCents, 0);

    return {
      totalPayments: payments.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalRevenueInCents: totalRevenue,
      currency: payments[0]?.currency || "usd",
    };
  },
});

/**
 * Internal query: fetch raw payment config for a challenge.
 * Used by HTTP API handlers (which handle auth at the HTTP layer).
 */
export const getPaymentConfigInternal = internalQuery({
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
      priceInCents: config.priceInCents,
      currency: config.currency,
      testMode: config.testMode,
      allowCustomAmount: config.allowCustomAmount ?? false,
      hasLiveKeys: !!(config.stripeSecretKey && config.stripePublishableKey),
      hasTestKeys: !!(config.stripeTestSecretKey && config.stripeTestPublishableKey),
      hasWebhookSecret: !!config.stripeWebhookSecret,
      hasTestWebhookSecret: !!config.stripeTestWebhookSecret,
      // Publishable keys are public — safe to return
      stripePublishableKey: config.stripePublishableKey ?? null,
      stripeTestPublishableKey: config.stripeTestPublishableKey ?? null,
    };
  },
});
