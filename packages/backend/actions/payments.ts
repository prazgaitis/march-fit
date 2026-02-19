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

/**
 * Create a Stripe Checkout session for joining a challenge.
 * This must be an action (not a mutation) because the Stripe SDK uses setTimeout.
 */
export const createCheckoutSession = action({
  args: {
    challengeId: v.id("challenges"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("Not authenticated");
    }

    // Look up user + participation + payment config via internal queries
    const checkoutData = await ctx.runQuery(
      internal.queries.paymentConfigInternal.getCheckoutData,
      {
        email: identity.email,
        challengeId: args.challengeId,
      }
    );

    if (!checkoutData) {
      throw new Error("Could not load checkout data");
    }

    if (checkoutData.error) {
      throw new Error(checkoutData.error);
    }

    const { userId, challengeName, challengeDescription, config } = checkoutData;

    // Get the appropriate keys
    const encryptedSecretKey = config.testMode
      ? config.stripeTestSecretKey
      : config.stripeSecretKey;

    if (!encryptedSecretKey) {
      throw new Error(
        config.testMode
          ? "Test mode enabled but test keys not configured"
          : "Live keys not configured"
      );
    }

    const secretKey = decryptKey(encryptedSecretKey);
    const stripe = createStripeClient(secretKey);

    // Build the line item for the checkout session
    let lineItem: Record<string, unknown>;

    if (config.allowCustomAmount) {
      // Pay-what-you-want requires a Price object created via the API —
      // custom_unit_amount is not supported on inline price_data.
      const product = await stripe.products.create({
        name: `Join ${challengeName}`,
        description: challengeDescription || `Entry fee for ${challengeName}`,
      });

      const price = await stripe.prices.create({
        currency: config.currency,
        product: product.id,
        custom_unit_amount: {
          enabled: true,
          minimum: config.priceInCents,
          preset: config.priceInCents,
        },
      });

      lineItem = { price: price.id, quantity: 1 };
    } else {
      lineItem = {
        price_data: {
          currency: config.currency,
          product_data: {
            name: `Join ${challengeName}`,
            description: challengeDescription || `Entry fee for ${challengeName}`,
          },
          unit_amount: config.priceInCents,
        },
        quantity: 1,
      };
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [lineItem as any],
      mode: "payment",
      success_url: `${args.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl,
      customer_email: identity.email,
      metadata: {
        challengeId: args.challengeId,
        userId,
      },
    });

    // Create DB records (payment record + update participation)
    await ctx.runMutation(internal.mutations.payments.prepareCheckout, {
      userId: userId as any,
      challengeId: args.challengeId,
      stripeCheckoutSessionId: session.id,
      amountInCents: config.priceInCents,
      currency: config.currency,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

/**
 * Verify a checkout session (fallback for when webhook didn't fire).
 * This must be an action because it calls the Stripe SDK.
 * Does not require auth — the Stripe session ID is sufficient proof.
 * The userId is looked up from the existing payment record.
 */
export const verifyCheckoutSession = action({
  args: {
    challengeId: v.id("challenges"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up payment config (no auth needed — just reads config by challengeId)
    const verifyData = await ctx.runQuery(
      internal.queries.paymentConfigInternal.getVerifyData,
      {
        challengeId: args.challengeId,
        stripeCheckoutSessionId: args.sessionId,
      }
    );

    if (!verifyData) {
      throw new Error("Payment record not found");
    }

    if (verifyData.error) {
      throw new Error(verifyData.error);
    }

    if (verifyData.alreadyCompleted) {
      return { success: true, alreadyCompleted: true };
    }

    const { userId, config } = verifyData;

    if (!config) {
      throw new Error("Payment not configured");
    }

    const encryptedSecretKey = config.testMode
      ? config.stripeTestSecretKey
      : config.stripeSecretKey;

    if (!encryptedSecretKey) {
      throw new Error("Stripe keys not configured");
    }

    const secretKey = decryptKey(encryptedSecretKey);
    const stripe = createStripeClient(secretKey);

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(args.sessionId);

    if (session.payment_status !== "paid") {
      return { success: false, status: session.payment_status };
    }

    // Update DB records via internal mutation
    const result = await ctx.runMutation(internal.mutations.payments.completeVerification, {
      userId: userId as any,
      challengeId: args.challengeId,
      sessionId: args.sessionId,
      stripePaymentIntentId: (session.payment_intent as string) || undefined,
      stripeCustomerId: (session.customer as string) || undefined,
      stripeCustomerEmail: session.customer_email ?? undefined,
    });

    return result;
  },
});
