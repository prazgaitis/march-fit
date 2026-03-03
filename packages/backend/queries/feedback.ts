import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getCurrentUser } from "../lib/ids";

async function getAdminStatus(
  ctx: QueryCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">
) {
  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (challenge.creatorId === userId) {
    return { isParticipant: true, isAdmin: true };
  }

  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .first();

  return {
    isParticipant: !!participation,
    isAdmin: participation?.role === "admin",
  };
}

async function assertChallengeAdmin(
  ctx: QueryCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  userRole: "user" | "admin"
) {
  if (userRole === "admin") {
    return;
  }

  const { isAdmin } = await getAdminStatus(ctx, userId, challengeId);
  if (!isAdmin) {
    throw new Error("Not authorized - challenge admin required");
  }
}

async function buildFeedbackRows(
  ctx: QueryCtx,
  challengeId: Id<"challenges">,
  reporterUserId?: Id<"users">
) {
  const feedback = await ctx.db
    .query("feedback")
    .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
    .collect();

  return Promise.all(
    feedback
      .filter((entry) => (reporterUserId ? entry.userId === reporterUserId : true))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(async (entry) => {
        const [reporter, fixedBy, respondedBy] = await Promise.all([
          ctx.db.get(entry.userId),
          entry.fixedById ? ctx.db.get(entry.fixedById) : null,
          entry.respondedById ? ctx.db.get(entry.respondedById) : null,
        ]);

        return {
          ...entry,
          id: entry._id,
          reporter: reporter
            ? {
                id: reporter._id,
                name: reporter.name ?? null,
                username: reporter.username ?? "unknown",
                avatarUrl: reporter.avatarUrl ?? null,
              }
            : null,
          fixedBy: fixedBy
            ? {
                id: fixedBy._id,
                name: fixedBy.name ?? null,
                username: fixedBy.username ?? "unknown",
              }
            : null,
          respondedBy: respondedBy
            ? {
                id: respondedBy._id,
                name: respondedBy.name ?? null,
                username: respondedBy.username ?? "unknown",
              }
            : null,
        };
      })
  );
}

export const listByChallenge = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const { isParticipant, isAdmin } = await getAdminStatus(ctx, user._id, args.challengeId);

    if (!isParticipant && user.role !== "admin") {
      throw new Error("Must be a challenge participant");
    }

    const rows = await buildFeedbackRows(ctx, args.challengeId, user._id);

    return {
      items: rows,
      canMarkFixed: isAdmin || user.role === "admin",
    };
  },
});

export const listForAdmin = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await assertChallengeAdmin(ctx, user._id, args.challengeId, user.role);
    return { items: await buildFeedbackRows(ctx, args.challengeId) };
  },
});

export const listByChallengeInternal = internalQuery({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    return { items: await buildFeedbackRows(ctx, args.challengeId) };
  },
});

export const getByIdInternal = internalQuery({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.feedbackId);
  },
});
