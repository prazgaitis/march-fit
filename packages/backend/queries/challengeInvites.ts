import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";
import { coerceDateOnlyToString } from "../lib/dateOnly";

/**
 * Resolve an invite code to get challenge and inviter info.
 * Public query - no auth required (so unauthenticated users can see the invite page).
 */
export const resolveInviteCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("challengeInvites")
      .withIndex("code", (q) => q.eq("code", args.code))
      .first();

    if (!invite) {
      return null;
    }

    const [challenge, inviter] = await Promise.all([
      ctx.db.get(invite.challengeId),
      ctx.db.get(invite.userId),
    ]);

    if (!challenge || !inviter) {
      return null;
    }

    // Get participant count
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) => q.eq("challengeId", challenge._id))
      .collect();

    return {
      challengeId: challenge._id,
      challengeName: challenge.name,
      challengeDescription: challenge.description,
      startDate: coerceDateOnlyToString(challenge.startDate),
      endDate: coerceDateOnlyToString(challenge.endDate),
      durationDays: challenge.durationDays,
      participantCount: participations.length,
      inviter: {
        id: inviter._id,
        name: inviter.name,
        username: inviter.username,
        avatarUrl: inviter.avatarUrl,
      },
    };
  },
});

/**
 * Get the current user's invite code for a challenge (read-only).
 * Returns null if no code has been generated yet.
 */
export const getMyInviteCode = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const invite = await ctx.db
      .query("challengeInvites")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    return invite?.code ?? null;
  },
});
