/**
 * TEMPORARY — delete after use.
 * Run from Convex dashboard to manually set a participant's payment status.
 *
 * Usage: run mutations/temp_setPaymentStatus:setPaymentStatus
 * Args:  { userId: "...", challengeId: "...", status: "paid" | "unpaid" | "pending" }
 */
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const setPaymentStatus = internalMutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    status: v.union(
      v.literal("paid"),
      v.literal("unpaid"),
      v.literal("pending"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", args.userId).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error(`No participation found for userId=${args.userId} challengeId=${args.challengeId}`);
    }

    await ctx.db.patch(participation._id, {
      paymentStatus: args.status,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      participationId: participation._id,
      previousStatus: participation.paymentStatus,
      newStatus: args.status,
    };
  },
});
