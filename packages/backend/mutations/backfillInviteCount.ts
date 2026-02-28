import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Backfill inviteCount on all userChallenges records.
 *
 * For each participation, counts how many other participants in the same
 * challenge have invitedByUserId pointing to that user, then patches
 * the inviteCount field.
 *
 * Run via:
 *   npx convex run mutations/backfillInviteCount:backfillInviteCount '{"dryRun": true}'
 *   npx convex run mutations/backfillInviteCount:backfillInviteCount '{"dryRun": false}'
 *
 * Or scoped to a single challenge:
 *   npx convex run mutations/backfillInviteCount:backfillInviteCount '{"dryRun": true, "challengeId": "<id>"}'
 */
export const backfillInviteCount = internalMutation({
  args: {
    dryRun: v.boolean(),
    challengeId: v.optional(v.id("challenges")),
  },
  handler: async (ctx, args) => {
    // Get participations — scoped to a single challenge or all
    let participations;
    if (args.challengeId) {
      participations = await ctx.db
        .query("userChallenges")
        .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId!))
        .collect();
    } else {
      participations = await ctx.db.query("userChallenges").collect();
    }

    // Build a map of (userId, challengeId) → count of people they invited
    const inviteCounts = new Map<string, number>();
    for (const p of participations) {
      if (p.invitedByUserId) {
        const key = `${p.invitedByUserId}:${p.challengeId}`;
        inviteCounts.set(key, (inviteCounts.get(key) ?? 0) + 1);
      }
    }

    const updates: Array<{
      participationId: string;
      userId: string;
      challengeId: string;
      oldCount: number;
      newCount: number;
    }> = [];

    for (const p of participations) {
      const key = `${p.userId}:${p.challengeId}`;
      const newCount = inviteCounts.get(key) ?? 0;
      const oldCount = p.inviteCount ?? 0;

      if (oldCount !== newCount) {
        updates.push({
          participationId: p._id,
          userId: p.userId,
          challengeId: p.challengeId,
          oldCount,
          newCount,
        });

        if (!args.dryRun) {
          await ctx.db.patch(p._id, { inviteCount: newCount });
        }
      }
    }

    return {
      dryRun: args.dryRun,
      totalParticipations: participations.length,
      updatedCount: updates.length,
      updates,
    };
  },
});
