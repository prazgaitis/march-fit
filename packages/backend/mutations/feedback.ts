import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "../lib/ids";
import { insertNotification } from "../lib/notifications";

async function assertParticipant(
  ctx: MutationCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  userRole: "user" | "admin"
) {
  if (userRole === "admin") return;

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (challenge.creatorId === userId) {
    return;
  }

  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .first();

  if (!participation) {
    throw new Error("Must be a challenge participant");
  }
}

async function assertChallengeAdmin(
  ctx: MutationCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  userRole: "user" | "admin"
) {
  if (userRole === "admin") return;

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (challenge.creatorId === userId) return;

  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .first();

  if (participation?.role !== "admin") {
    throw new Error("Not authorized - challenge admin required");
  }
}

export const create = mutation({
  args: {
    challengeId: v.id("challenges"),
    type: v.union(
      v.literal("bug"),
      v.literal("question"),
      v.literal("idea"),
      v.literal("other")
    ),
    title: v.optional(v.string()),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const title = args.title?.trim();
    const description = args.description.trim();

    if (!description) {
      throw new Error("Description is required");
    }

    await assertParticipant(ctx, user._id, args.challengeId, user.role);

    const now = Date.now();
    return await ctx.db.insert("feedback", {
      challengeId: args.challengeId,
      userId: user._id,
      type: args.type,
      title: title && title.length > 0 ? title : undefined,
      description,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markFixed = mutation({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const entry = await ctx.db.get(args.feedbackId);
    if (!entry) {
      throw new Error("Feedback not found");
    }

    await assertChallengeAdmin(ctx, user._id, entry.challengeId, user.role);

    if (entry.status === "fixed") {
      return { success: true };
    }

    await ctx.db.patch(entry._id, {
      status: "fixed",
      fixedAt: Date.now(),
      fixedById: user._id,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateByAdmin = mutation({
  args: {
    feedbackId: v.id("feedback"),
    status: v.optional(v.union(v.literal("open"), v.literal("fixed"))),
    adminResponse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const entry = await ctx.db.get(args.feedbackId);
    if (!entry) {
      throw new Error("Feedback not found");
    }

    await assertChallengeAdmin(ctx, user._id, entry.challengeId, user.role);

    if (args.status === undefined && args.adminResponse === undefined) {
      throw new Error("At least one field is required: status or adminResponse");
    }

    const now = Date.now();
    const patch: Partial<typeof entry> & { updatedAt: number } = {
      updatedAt: now,
    };

    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "fixed") {
        patch.fixedAt = now;
        patch.fixedById = user._id;
      } else {
        patch.fixedAt = undefined;
        patch.fixedById = undefined;
      }
    }

    if (args.adminResponse !== undefined) {
      const trimmed = args.adminResponse.trim();
      // Keep legacy fields for backward compat
      patch.adminResponse = trimmed.length > 0 ? trimmed : undefined;
      patch.respondedAt = trimmed.length > 0 ? now : undefined;
      patch.respondedById = trimmed.length > 0 ? user._id : undefined;

      // Also create a comment in the generalized comments table
      if (trimmed.length > 0) {
        await ctx.db.insert("comments", {
          parentType: "feedback",
          feedbackId: args.feedbackId,
          userId: user._id,
          content: trimmed,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(entry._id, patch);

    // Notify the reporter if someone else is responding or marking fixed
    const reporterIsActor = entry.userId === user._id;
    if (!reporterIsActor) {
      const isNewResponse =
        args.adminResponse !== undefined &&
        args.adminResponse.trim().length > 0 &&
        args.adminResponse.trim() !== entry.adminResponse;
      const isMarkedFixed =
        args.status === "fixed" && entry.status !== "fixed";

      if (isNewResponse || isMarkedFixed) {
        await insertNotification(ctx, {
          userId: entry.userId,
          actorId: user._id,
          type: isNewResponse ? "feedback_comment" : "feedback_response",
          data: {
            feedbackId: entry._id,
            challengeId: entry.challengeId,
            title: entry.title ?? entry.description.slice(0, 60),
            event: isMarkedFixed ? "fixed" : "reply",
          },
          createdAt: now,
        });
      }
    }

    return { success: true };
  },
});
