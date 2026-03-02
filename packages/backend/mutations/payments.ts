import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireCurrentUser } from "../lib/ids";

/**
 * Schedule on_signup emails if any enabled sequences exist for the challenge.
 * Used after payment is confirmed to send welcome emails.
 */
async function scheduleSignupEmails(
  ctx: { db: any; scheduler: any },
  challengeId: Id<"challenges">,
  userId: Id<"users">,
) {
  const signupSequences = await ctx.db
    .query("emailSequences")
    .withIndex("challengeTrigger", (q: any) =>
      q.eq("challengeId", challengeId).eq("trigger", "on_signup")
    )
    .collect();

  const hasEnabled = signupSequences.some((seq: any) => seq.enabled);
  if (hasEnabled) {
    await ctx.scheduler.runAfter(
      0,
      internal.mutations.emailSequences.triggerOnSignup,
      { challengeId, userId },
    );
  }
}

async function creditInviteAttributionOnPayment(
  ctx: { db: any },
  participation: {
    invitedByUserId?: Id<"users">;
    challengeId: Id<"challenges">;
    userId: Id<"users">;
  },
  now: number,
) {
  if (!participation.invitedByUserId || participation.invitedByUserId === participation.userId) {
    return;
  }

  const inviterParticipation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", participation.invitedByUserId).eq("challengeId", participation.challengeId)
    )
    .first();

  if (inviterParticipation) {
    await ctx.db.patch(inviterParticipation._id, {
      inviteCount: (inviterParticipation.inviteCount ?? 0) + 1,
      updatedAt: now,
    });
  }

  const challenge = await ctx.db.get(participation.challengeId);
  await ctx.db.insert("notifications", {
    userId: participation.invitedByUserId,
    actorId: participation.userId,
    type: "invite_accepted",
    data: {
      challengeId: participation.challengeId,
      challengeName: challenge?.name ?? "Challenge",
    },
    createdAt: now,
  });
}

/**
 * Clear a user's test payment data so they can re-test the payment flow.
 * Only works when the challenge payment config is in test mode.
 * Requires challenge admin permissions.
 */
export const clearTestPayment = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Auth: require challenge admin
    const currentUser = await requireCurrentUser(ctx);

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const isGlobalAdmin = currentUser.role === "admin";
    const isCreator = challenge.creatorId === currentUser._id;
    const adminParticipation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", currentUser._id).eq("challengeId", args.challengeId)
      )
      .first();
    const isChallengeAdmin = adminParticipation?.role === "admin";

    if (!isGlobalAdmin && !isCreator && !isChallengeAdmin) {
      throw new Error("Not authorized - challenge admin required");
    }

    // Verify test mode is enabled
    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    if (!paymentConfig || !paymentConfig.testMode) {
      throw new Error("Can only clear payments when test mode is enabled");
    }

    const now = Date.now();

    // Reset payment status on the user's participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    if (participation) {
      await ctx.db.patch(participation._id, {
        paymentStatus: "unpaid",
        paymentReceivedAt: undefined,
        paymentReference: undefined,
        updatedAt: now,
      });
    }

    // Delete all payment records for this user + challenge
    const paymentRecords = await ctx.db
      .query("paymentRecords")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const userPaymentRecords = paymentRecords.filter(
      (r) => r.userId === args.userId
    );

    for (const record of userPaymentRecords) {
      await ctx.db.delete(record._id);
    }

    return { success: true, deletedRecords: userPaymentRecords.length };
  },
});

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
    invitedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const invitedByUserId =
      args.invitedByUserId && args.invitedByUserId !== args.userId
        ? args.invitedByUserId
        : undefined;

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
        invitedByUserId,
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
        ...(invitedByUserId && !existingParticipation.invitedByUserId
          ? { invitedByUserId }
          : {}),
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
    // Metadata from Stripe session — used to self-heal if prepareCheckout never ran
    challengeId: v.optional(v.id("challenges")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the payment record
    let paymentRecord = await ctx.db
      .query("paymentRecords")
      .withIndex("stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first();

    // Self-heal: if no payment record exists but we have metadata, create one
    if (!paymentRecord) {
      if (!args.challengeId || !args.userId) {
        console.error("Payment record not found and no metadata to self-heal for session:", args.stripeCheckoutSessionId);
        return { success: false, error: "Payment record not found" };
      }

      console.warn("Self-healing: creating missing payment record for session:", args.stripeCheckoutSessionId);
      const paymentRecordId = await ctx.db.insert("paymentRecords", {
        challengeId: args.challengeId,
        userId: args.userId,
        stripeCheckoutSessionId: args.stripeCheckoutSessionId,
        stripePaymentIntentId: args.stripePaymentIntentId,
        stripeCustomerId: args.stripeCustomerId,
        stripeCustomerEmail: args.stripeCustomerEmail,
        amountInCents: args.amountInCents ?? 0,
        currency: "usd",
        status: "completed",
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      paymentRecord = (await ctx.db.get(paymentRecordId))!;
    }

    // Idempotency: Stripe can retry webhooks for the same session.
    if (paymentRecord.status === "completed") {
      // Even if already completed, ensure participation exists (covers partial self-heal)
      const existingParticipation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", paymentRecord.userId).eq("challengeId", paymentRecord.challengeId)
        )
        .first();

      if (!existingParticipation) {
        console.warn("Self-healing: creating missing participation for already-completed payment:", args.stripeCheckoutSessionId);
        await ctx.db.insert("userChallenges", {
          userId: paymentRecord.userId,
          challengeId: paymentRecord.challengeId,
          joinedAt: now,
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          paymentReceivedAt: now,
          paymentReference: args.stripePaymentIntentId || args.stripeCheckoutSessionId,
          updatedAt: now,
        });
        await scheduleSignupEmails(ctx, paymentRecord.challengeId, paymentRecord.userId);
      }

      return { success: true, alreadyCompleted: true };
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
    let participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", paymentRecord.userId).eq("challengeId", paymentRecord.challengeId)
      )
      .first();

    if (participation) {
      const transitionedToPaid = participation.paymentStatus !== "paid";

      await ctx.db.patch(participation._id, {
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: args.stripePaymentIntentId || args.stripeCheckoutSessionId,
        updatedAt: now,
      });

      if (transitionedToPaid) {
        await creditInviteAttributionOnPayment(ctx, participation, now);
      }

      // Update the payment record with userChallengeId if not set
      if (!paymentRecord.userChallengeId) {
        await ctx.db.patch(paymentRecord._id, {
          userChallengeId: participation._id,
        });
      }

      // Trigger on_signup emails now that payment is confirmed
      await scheduleSignupEmails(ctx, paymentRecord.challengeId, paymentRecord.userId);
    } else {
      // Self-heal: create missing participation record
      console.warn("Self-healing: creating missing participation for session:", args.stripeCheckoutSessionId);
      const participationId = await ctx.db.insert("userChallenges", {
        userId: paymentRecord.userId,
        challengeId: paymentRecord.challengeId,
        joinedAt: now,
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: args.stripePaymentIntentId || args.stripeCheckoutSessionId,
        updatedAt: now,
      });

      await ctx.db.patch(paymentRecord._id, {
        userChallengeId: participationId,
      });

      await scheduleSignupEmails(ctx, paymentRecord.challengeId, paymentRecord.userId);
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
      const transitionedToPaid = participation.paymentStatus !== "paid";

      await ctx.db.patch(participation._id, {
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: args.stripePaymentIntentId || args.sessionId,
        updatedAt: now,
      });

      if (transitionedToPaid) {
        await creditInviteAttributionOnPayment(ctx, participation, now);
      }

      // Trigger on_signup emails now that payment is confirmed
      await scheduleSignupEmails(ctx, args.challengeId, args.userId);
    } else {
      // Self-heal: create missing participation record
      console.warn("Self-healing: creating missing participation in completeVerification for session:", args.sessionId);
      const participationId = await ctx.db.insert("userChallenges", {
        userId: args.userId,
        challengeId: args.challengeId,
        joinedAt: now,
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        paymentReceivedAt: now,
        paymentReference: args.stripePaymentIntentId || args.sessionId,
        updatedAt: now,
      });

      await ctx.db.patch(paymentRecord._id, {
        userChallengeId: participationId,
      });

      await scheduleSignupEmails(ctx, args.challengeId, args.userId);
    }

    return { success: true };
  },
});
