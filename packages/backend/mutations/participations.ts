import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/ids";
import { isPaymentRequired } from "../lib/payments";

// Helper to check if user is challenge admin (mirrors challenges.ts)
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

  const isGlobalAdmin = user.role === "admin";
  const isCreator = challenge.creatorId === user._id;

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

  return user;
}

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
    inviteCode: v.optional(v.string()),
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

    // Resolve inviter from invite code if provided
    let invitedByUserId = args.invitedByUserId;
    const inviteCode = args.inviteCode;
    if (inviteCode && !invitedByUserId) {
      const invite = await ctx.db
        .query("challengeInvites")
        .withIndex("code", (q) => q.eq("code", inviteCode))
        .first();
      if (invite && invite.challengeId === args.challengeId) {
        invitedByUserId = invite.userId;
      }
    }

    // Block self-join for private challenges (requires admin invitation)
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }
    if (challenge.visibility === "private" && !invitedByUserId) {
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
      invitedByUserId: invitedByUserId,
      joinedAt: now,
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: requiresPayment ? "unpaid" : "paid",
      updatedAt: now,
    });

    // Auto-create mutual follow relationships if joined via invite
    if (invitedByUserId && invitedByUserId !== user._id) {
      // Invitee follows inviter
      const existingFollow1 = await ctx.db
        .query("follows")
        .withIndex("followerFollowing", (q) =>
          q.eq("followerId", user._id).eq("followingId", invitedByUserId)
        )
        .first();
      if (!existingFollow1) {
        await ctx.db.insert("follows", {
          followerId: user._id,
          followingId: invitedByUserId,
          createdAt: now,
        });
      }

      // Inviter follows invitee
      const existingFollow2 = await ctx.db
        .query("follows")
        .withIndex("followerFollowing", (q) =>
          q.eq("followerId", invitedByUserId).eq("followingId", user._id)
        )
        .first();
      if (!existingFollow2) {
        await ctx.db.insert("follows", {
          followerId: invitedByUserId,
          followingId: user._id,
          createdAt: now,
        });
      }
    }

    // Schedule on_signup emails asynchronously so they don't block the join.
    // Only schedule if there are any enabled signup sequences for this challenge.
    const signupSequences = await ctx.db
      .query("emailSequences")
      .withIndex("challengeTrigger", (q) =>
        q.eq("challengeId", args.challengeId).eq("trigger", "on_signup")
      )
      .collect();

    const hasEnabledSignupEmails = signupSequences.some((seq) => seq.enabled);

    if (hasEnabledSignupEmails) {
      await ctx.scheduler.runAfter(0, internal.mutations.emailSequences.triggerOnSignup, {
        challengeId: args.challengeId,
        userId: user._id,
      });
    }

    return participationId;
  },
});

/**
 * Update a participant's challenge role (admin/member)
 */
export const updateRole = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    role: v.union(v.literal("member"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error("Participation not found");
    }

    await ctx.db.patch(participation._id, { role: args.role });
  },
});
