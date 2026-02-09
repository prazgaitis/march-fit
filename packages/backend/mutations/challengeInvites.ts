import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get or create an invite code for the current user in a challenge.
 * Returns the existing code if one already exists.
 */
export const getOrCreateInviteCode = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check user is a participant
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error("Not participating in this challenge");
    }

    // Check if invite code already exists
    const existing = await ctx.db
      .query("challengeInvites")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (existing) {
      return existing.code;
    }

    // Generate a unique code
    let code = generateInviteCode();
    // Check for collision (very unlikely with 8 chars from 55-char alphabet)
    let existingCode = await ctx.db
      .query("challengeInvites")
      .withIndex("code", (q) => q.eq("code", code))
      .first();
    while (existingCode) {
      code = generateInviteCode();
      existingCode = await ctx.db
        .query("challengeInvites")
        .withIndex("code", (q) => q.eq("code", code))
        .first();
    }

    await ctx.db.insert("challengeInvites", {
      challengeId: args.challengeId,
      userId: user._id,
      code,
      createdAt: Date.now(),
    });

    return code;
  },
});
