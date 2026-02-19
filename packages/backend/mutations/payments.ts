import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/ids";

/**
 * Internal mutation: prepare a checkout by validating state and creating DB records.
 * Called by the createCheckoutSession action after it creates the Stripe session.
 */
export const prepareCheckout = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    stripeCheckoutSessionId: v.string(),
    amountInCents: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check existing participation
    const existingParticipation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    // Create a pending payment record
    await ctx.db.insert("paymentRecords", {
      challengeId: args.challengeId,
      userId: args.userId,
      userChallengeId: existingParticipation?._id,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      amountInCents: args.amountInCents,
      currency: args.currency,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // If user doesn't have a participation yet, create one with pending payment
    if (!existingParticipation) {
      await ctx.db.insert("userChallenges", {
        userId: args.userId,
        challengeId: args.challengeId,
        joinedAt: now,
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "pending",
        paymentReference: args.stripeCheckoutSessionId,
        updatedAt: now,
      });
    } else {
      // Update existing participation to pending
      await ctx.db.patch(existingParticipation._id, {
        paymentStatus: "pending",
        paymentReference: args.stripeCheckoutSessionId,
        updatedAt: now,
      });
    }
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
 * Internal mutation: mark a checkout session as verified/completed.
 * Called by the verifyCheckoutSession action.
 */
export const completeVerification = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    sessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeCustomerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeCustomerId: args.stripeCustomerId,
      stripeCustomerEmail: args.stripeCustomerEmail,
      completedAt: now,
      updatedAt: now,
    });

    // Update participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: args.stripePaymentIntentId || args.sessionId,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});
