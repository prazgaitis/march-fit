import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { decryptKey, createStripeClient } from "../lib/stripe";
import { getCurrentUser } from "../lib/ids";

/**
 * Create a Stripe Checkout session for joining a challenge
 */
export const createCheckoutSession = mutation({
  args: {
    challengeId: v.id("challenges"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get challenge
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Check if user already has a participation
    const existingParticipation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (existingParticipation?.paymentStatus === "paid") {
      throw new Error("Already paid for this challenge");
    }

    // Get payment config
    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!config) {
      throw new Error("Payment not configured for this challenge");
    }

    if (config.priceInCents <= 0) {
      throw new Error("Challenge is free - no payment required");
    }

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

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: config.currency,
            product_data: {
              name: `Join ${challenge.name}`,
              description: challenge.description || `Entry fee for ${challenge.name}`,
            },
            ...(config.allowCustomAmount
              ? {
                  custom_unit_amount: {
                    enabled: true,
                    minimum: config.priceInCents, // floor — can't pay less than this
                    preset: config.priceInCents,  // pre-filled suggestion
                  },
                }
              : {
                  unit_amount: config.priceInCents, // fixed price (existing behavior)
                }),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${args.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl,
      customer_email: user.email,
      metadata: {
        challengeId: args.challengeId,
        userId: user._id,
      },
    });

    // Create a pending payment record
    const now = Date.now();
    await ctx.db.insert("paymentRecords", {
      challengeId: args.challengeId,
      userId: user._id,
      userChallengeId: existingParticipation?._id,
      stripeCheckoutSessionId: session.id,
      amountInCents: config.priceInCents,
      currency: config.currency,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // If user doesn't have a participation yet, create one with pending payment
    if (!existingParticipation) {
      await ctx.db.insert("userChallenges", {
        userId: user._id,
        challengeId: args.challengeId,
        joinedAt: now,
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "pending",
        paymentReference: session.id,
        updatedAt: now,
      });
    } else {
      // Update existing participation to pending
      await ctx.db.patch(existingParticipation._id, {
        paymentStatus: "pending",
        paymentReference: session.id,
        updatedAt: now,
      });
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

/**
 * Internal mutation to handle successful payment (called by webhook)
 */
export const handlePaymentSuccess = internalMutation({
  args: {
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeCustomerEmail: v.optional(v.string()),
    amountInCents: v.optional(v.number()), // Actual amount paid (may exceed minimum in donation mode)
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the payment record
    const paymentRecord = await ctx.db
      .query("paymentRecords")
      .withIndex("stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first();

    if (!paymentRecord) {
      console.error("Payment record not found for session:", args.stripeCheckoutSessionId);
      return { success: false, error: "Payment record not found" };
    }

    // Update payment record — use actual amount paid if provided (donation mode)
    await ctx.db.patch(paymentRecord._id, {
      status: "completed",
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeCustomerId: args.stripeCustomerId,
      stripeCustomerEmail: args.stripeCustomerEmail,
      ...(args.amountInCents !== undefined && { amountInCents: args.amountInCents }),
      completedAt: now,
      updatedAt: now,
    });

    // Find and update user challenge participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", paymentRecord.userId).eq("challengeId", paymentRecord.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: args.stripePaymentIntentId || args.stripeCheckoutSessionId,
        updatedAt: now,
      });

      // Update the payment record with userChallengeId if not set
      if (!paymentRecord.userChallengeId) {
        await ctx.db.patch(paymentRecord._id, {
          userChallengeId: participation._id,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Internal mutation to handle failed payment (called by webhook)
 */
export const handlePaymentFailure = internalMutation({
  args: {
    stripeCheckoutSessionId: v.string(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the payment record
    const paymentRecord = await ctx.db
      .query("paymentRecords")
      .withIndex("stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first();

    if (!paymentRecord) {
      console.error("Payment record not found for session:", args.stripeCheckoutSessionId);
      return { success: false, error: "Payment record not found" };
    }

    // Update payment record
    await ctx.db.patch(paymentRecord._id, {
      status: "failed",
      failureReason: args.failureReason,
      updatedAt: now,
    });

    // Update user challenge participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", paymentRecord.userId).eq("challengeId", paymentRecord.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        paymentStatus: "failed",
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Verify a checkout session (fallback for when webhook didn't fire)
 */
export const verifyCheckoutSession = mutation({
  args: {
    challengeId: v.id("challenges"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get payment config
    const config = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

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

    // Find payment record
    const paymentRecord = await ctx.db
      .query("paymentRecords")
      .withIndex("stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.sessionId)
      )
      .first();

    if (!paymentRecord) {
      throw new Error("Payment record not found");
    }

    // If already completed, just return success
    if (paymentRecord.status === "completed") {
      return { success: true, alreadyCompleted: true };
    }

    // Update payment record
    const now = Date.now();
    await ctx.db.patch(paymentRecord._id, {
      status: "completed",
      stripePaymentIntentId: session.payment_intent as string,
      stripeCustomerId: session.customer as string,
      stripeCustomerEmail: session.customer_email ?? undefined,
      completedAt: now,
      updatedAt: now,
    });

    // Update participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: (session.payment_intent as string) || args.sessionId,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});
