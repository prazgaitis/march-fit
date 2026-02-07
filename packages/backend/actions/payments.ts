"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { decryptKey, createStripeClient } from "../lib/stripe";

/**
 * Test Stripe connection with the configured keys
 * This is an action because Stripe SDK uses setTimeout which isn't allowed in mutations
 */
export const testStripeConnection = action({
  args: {
    challengeId: v.id("challenges"),
    useTestKeys: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is challenge admin
    if (!identity.email) {
      throw new Error("Not authenticated - email required");
    }
    const adminCheck = await ctx.runQuery(
      internal.queries.paymentConfigInternal.checkChallengeAdmin,
      {
        email: identity.email,
        challengeId: args.challengeId,
      }
    );

    if (!adminCheck.isAdmin) {
      throw new Error(adminCheck.error || "Not authorized - challenge admin required");
    }

    // Get payment config with secret keys
    const config = await ctx.runQuery(
      internal.queries.paymentConfigInternal.getConfigWithSecretKeys,
      {
        challengeId: args.challengeId,
      }
    );

    if (!config) {
      throw new Error("Payment config not found");
    }

    const encryptedKey = args.useTestKeys
      ? config.stripeTestSecretKey
      : config.stripeSecretKey;

    if (!encryptedKey) {
      throw new Error(
        args.useTestKeys
          ? "Test secret key not configured"
          : "Live secret key not configured"
      );
    }

    try {
      const secretKey = decryptKey(encryptedKey);
      const stripe = createStripeClient(secretKey);

      // Try to retrieve account info to verify the key works
      const account = await stripe.accounts.retrieve();

      return {
        success: true,
        accountId: account.id,
        accountName: account.business_profile?.name || account.email || "Unknown",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});
