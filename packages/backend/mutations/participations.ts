import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { resend } from "../lib/resend";
import { getCurrentUser } from "../lib/ids";
import { isPaymentRequired } from "../lib/payments";

// Default from address - should be configured per deployment
const DEFAULT_FROM_EMAIL = "March Fitness <noreply@march.fit>";

// Internal mutation for seeding
export const create = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    invitedByUserId: v.optional(v.id("users")),
    joinedAt: v.number(),
    totalPoints: v.number(),
    currentStreak: v.number(),
    modifierFactor: v.number(),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("failed")
    ),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("userChallenges", args);
  },
});

/**
 * Join a challenge
 */
export const join = mutation({
  args: {
    challengeId: v.id("challenges"),
    invitedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Get the current user from auth
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      console.error("No identity found in Convex mutation");
      throw new Error("Not authenticated. Please sign in to join challenges.");
    }

    console.log("Identity found:", { subject: identity.subject, email: identity.email });

    // Get the user by email (linked to Better Auth)
    let user = await getCurrentUser(ctx);

    if (!user) {
      console.log("User not found in database, attempting to create...");

      // Fallback: Create the user if they don't exist
      // This handles cases where the webhook might have failed or hasn't arrived yet
      const now = Date.now();
      const email = identity.email;
      // Use name if available, otherwise fallback to email part or "User"
      const name = identity.name || identity.givenName || (email ? email.split('@')[0] : "User");
      const username = identity.nickname || (email ? email.split('@')[0] : `user_${now}`);

      if (!email) {
        console.error("Cannot create user: No email in identity");
        throw new Error("User not found and cannot be created without email. Please check your account settings.");
      }

      const userId = await ctx.db.insert("users", {
        email: email,
        username: username,
        name: name,
        avatarUrl: identity.pictureUrl,
        role: "user",
        createdAt: now,
        updatedAt: now,
      });

      user = await ctx.db.get(userId);
      
      if (!user) {
        console.error("Failed to retrieve created user");
        throw new Error("Failed to create user record. Please try again.");
      }
      
      console.log("Successfully created user via fallback in join mutation:", userId);
    }

    // Check if already participating
    const existing = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId),
      )
      .first();

    if (existing) {
      throw new Error("Already joined this challenge");
    }

    // Block self-join for private challenges (requires admin invitation)
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }
    if (challenge.visibility === "private") {
      throw new Error("This is a private challenge. You need an invitation to join.");
    }

    const now = Date.now();

    const paymentConfig = await ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .first();

    const requiresPayment = isPaymentRequired(paymentConfig);

    const participationId = await ctx.db.insert("userChallenges", {
      challengeId: args.challengeId,
      userId: user._id,
      invitedByUserId: args.invitedByUserId,
      joinedAt: now,
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: requiresPayment ? "unpaid" : "paid",
      updatedAt: now,
    });

    // Trigger on_signup emails
    const emailSequences = await ctx.db
      .query("emailSequences")
      .withIndex("challengeTrigger", (q) =>
        q.eq("challengeId", args.challengeId).eq("trigger", "on_signup"),
      )
      .collect();

    const enabledSequences = emailSequences.filter((seq) => seq.enabled);

    for (const sequence of enabledSequences) {
      // Check if already sent to this user (shouldn't happen on first join, but safety check)
      const existingSend = await ctx.db
        .query("emailSends")
        .withIndex("userSequence", (q) =>
          q.eq("userId", user._id).eq("emailSequenceId", sequence._id),
        )
        .first();

      if (!existingSend) {
        // Create email send record
        const sendId = await ctx.db.insert("emailSends", {
          emailSequenceId: sequence._id,
          userId: user._id,
          challengeId: args.challengeId,
          status: "pending",
          createdAt: now,
        });

        try {
          // Send the email via Resend component
          await resend.sendEmail(ctx, {
            from: DEFAULT_FROM_EMAIL,
            to: user.email,
            subject: sequence.subject,
            html: sequence.body,
          });

          await ctx.db.patch(sendId, {
            status: "sent",
            sentAt: Date.now(),
          });
        } catch (error) {
          await ctx.db.patch(sendId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Don't throw - we don't want to fail the join because of email issues
          console.error("Failed to send signup email:", error);
        }
      }
    }

    return participationId;
  },
});
