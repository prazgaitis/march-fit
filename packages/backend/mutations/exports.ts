import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import type { Id } from "../_generated/dataModel";

/**
 * Helper to check if user is challenge admin.
 */
async function requireChallengeAdmin(
  ctx: { db: any; auth: any },
  challengeId: Id<"challenges">,
) {
  const user = await requireCurrentUser(ctx as any);

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  const isGlobalAdmin = user.role === "admin";
  const isCreator = challenge.creatorId === user._id;

  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", user._id).eq("challengeId", challengeId),
    )
    .first();
  const isChallengeAdmin = participation?.role === "admin";

  if (!isGlobalAdmin && !isCreator && !isChallengeAdmin) {
    throw new Error("Not authorized - challenge admin required");
  }

  return { user, challenge };
}

/**
 * Request a new CSV export for a challenge.
 * Creates an export record and returns its ID so the action can be triggered.
 */
export const requestExport = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireChallengeAdmin(ctx, args.challengeId);

    const now = Date.now();
    const exportId = await ctx.db.insert("exports", {
      challengeId: args.challengeId,
      requestedById: user._id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { exportId };
  },
});

/**
 * Internal mutation: update export status to processing.
 */
export const markProcessing = internalMutation({
  args: {
    exportId: v.id("exports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "processing",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation: mark export as completed with storage ID.
 */
export const markCompleted = internalMutation({
  args: {
    exportId: v.id("exports"),
    storageId: v.id("_storage"),
    totalRows: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "completed",
      storageId: args.storageId,
      totalRows: args.totalRows,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation: mark export as failed.
 */
export const markFailed = internalMutation({
  args: {
    exportId: v.id("exports"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});
