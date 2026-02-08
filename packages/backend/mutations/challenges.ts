import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/ids";
import { dateOnlyToUtcMs } from "../lib/dateOnly";

// Helper to check if user is challenge admin
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

  // Check if global admin or challenge creator
  const isGlobalAdmin = user.role === "admin";
  const isCreator = challenge.creatorId === user._id;

  // Check challenge-specific admin role
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

  return { user, challenge };
}

// Internal mutation for seeding
export const create = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    durationDays: v.number(),
    streakMinPoints: v.number(),
    weekCalcMethod: v.string(),
    autoFlagRules: v.optional(v.any()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("challenges", args);
  },
});

// Public mutation for creating challenges (authenticated)
export const createChallenge = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    durationDays: v.number(),
    streakMinPoints: v.number(),
    weekCalcMethod: v.string(),
    autoFlagRules: v.optional(v.any()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const startDateMs = dateOnlyToUtcMs(args.startDate);
    const endDateMs = dateOnlyToUtcMs(args.endDate);
    if (!Number.isFinite(startDateMs) || !Number.isFinite(endDateMs)) {
      throw new Error("Invalid start or end date");
    }

    if (endDateMs < startDateMs) {
        throw new Error("End date must be after start date");
    }

    const now = Date.now();
    
    const challengeId = await ctx.db.insert("challenges", {
      name: args.name,
      description: args.description,
      creatorId: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
      durationDays: args.durationDays,
      streakMinPoints: args.streakMinPoints,
      weekCalcMethod: args.weekCalcMethod,
      autoFlagRules: args.autoFlagRules,
      visibility: args.visibility,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as participant
    await ctx.db.insert("userChallenges", {
        challengeId,
        userId: user._id,
        joinedAt: now,
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        updatedAt: now,
    });

    return challengeId;
  },
});

/**
 * Update challenge settings (admin only)
 */
export const updateChallenge = mutation({
  args: {
    challengeId: v.id("challenges"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    streakMinPoints: v.optional(v.number()),
    weekCalcMethod: v.optional(v.string()),
    welcomeVideoUrl: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    announcement: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const { challengeId, ...updates } = args;

    // Validate dates if both are provided
    if (updates.startDate !== undefined && updates.endDate !== undefined) {
      const startDateMs = dateOnlyToUtcMs(updates.startDate);
      const endDateMs = dateOnlyToUtcMs(updates.endDate);
      if (!Number.isFinite(startDateMs) || !Number.isFinite(endDateMs)) {
        throw new Error("Invalid start or end date");
      }
      if (endDateMs < startDateMs) {
        throw new Error("End date must be after start date");
      }
    }

    // Get current challenge to validate partial date updates
    const current = await ctx.db.get(challengeId);
    if (!current) {
      throw new Error("Challenge not found");
    }

    if (updates.startDate !== undefined && updates.endDate === undefined) {
      const startDateMs = dateOnlyToUtcMs(updates.startDate);
      if (!Number.isFinite(startDateMs)) {
        throw new Error("Invalid start date");
      }
      if (dateOnlyToUtcMs(current.endDate) < startDateMs) {
        throw new Error("Start date must be before existing end date");
      }
    }

    if (updates.endDate !== undefined && updates.startDate === undefined) {
      const endDateMs = dateOnlyToUtcMs(updates.endDate);
      if (!Number.isFinite(endDateMs)) {
        throw new Error("Invalid end date");
      }
      if (endDateMs < dateOnlyToUtcMs(current.startDate)) {
        throw new Error("End date must be after existing start date");
      }
    }

    // Calculate durationDays if dates change
    let durationDays = current.durationDays;
    const newStartDate = updates.startDate ?? current.startDate;
    const newEndDate = updates.endDate ?? current.endDate;
    if (updates.startDate !== undefined || updates.endDate !== undefined) {
      durationDays = Math.ceil(
        (dateOnlyToUtcMs(newEndDate) - dateOnlyToUtcMs(newStartDate)) / (1000 * 60 * 60 * 24)
      );
    }

    const now = Date.now();

    // Build update object with only defined values
    const updateData: Record<string, any> = {
      updatedAt: now,
      durationDays,
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.startDate !== undefined) updateData.startDate = updates.startDate;
    if (updates.endDate !== undefined) updateData.endDate = updates.endDate;
    if (updates.streakMinPoints !== undefined) updateData.streakMinPoints = updates.streakMinPoints;
    if (updates.weekCalcMethod !== undefined) updateData.weekCalcMethod = updates.weekCalcMethod;
    if (updates.welcomeVideoUrl !== undefined) updateData.welcomeVideoUrl = updates.welcomeVideoUrl;
    if (updates.welcomeMessage !== undefined) updateData.welcomeMessage = updates.welcomeMessage;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;

    // Handle announcement - update timestamp when announcement changes
    if (updates.announcement !== undefined) {
      updateData.announcement = updates.announcement;
      // Only update timestamp if announcement actually changed
      if (updates.announcement !== current.announcement) {
        updateData.announcementUpdatedAt = now;
      }
    }

    await ctx.db.patch(challengeId, updateData);

    return { success: true };
  },
});

/**
 * Dismiss announcement for current user
 */
export const dismissAnnouncement = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Find user's participation
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error("Not participating in this challenge");
    }

    await ctx.db.patch(participation._id, {
      dismissedAnnouncementAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Internal mutation for admin updates (no auth check)
export const internalUpdate = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { challengeId, ...updates } = args;

    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;

    await ctx.db.patch(challengeId, updateData);
    return { success: true };
  },
});
