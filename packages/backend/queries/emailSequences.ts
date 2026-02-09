import { query } from "../_generated/server";
import { v } from "convex/values";
import { DEFAULT_EMAIL_PLAN } from "../lib/defaultEmailPlan";
import { getEmailTemplatePreviewHtml } from "../lib/emailTemplate";

/**
 * List all email sequences for a challenge
 */
export const list = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const emailSequences = await ctx.db
      .query("emailSequences")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by createdAt descending (most recent first)
    emailSequences.sort((a, b) => b.createdAt - a.createdAt);

    // Get send counts for each sequence
    const result = await Promise.all(
      emailSequences.map(async (sequence) => {
        const sends = await ctx.db
          .query("emailSends")
          .withIndex("emailSequenceId", (q) =>
            q.eq("emailSequenceId", sequence._id),
          )
          .collect();

        const sentCount = sends.filter((s) => s.status === "sent").length;
        const pendingCount = sends.filter((s) => s.status === "pending").length;
        const failedCount = sends.filter((s) => s.status === "failed").length;

        return {
          ...sequence,
          id: sequence._id,
          sentCount,
          pendingCount,
          failedCount,
        };
      }),
    );

    return result;
  },
});

/**
 * Get a single email sequence by ID with send history
 */
export const getById = query({
  args: {
    emailSequenceId: v.id("emailSequences"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      return null;
    }

    // Get all sends with user data
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("emailSequenceId", (q) =>
        q.eq("emailSequenceId", args.emailSequenceId),
      )
      .collect();

    const sendsWithUsers = await Promise.all(
      sends.map(async (send) => {
        const user = await ctx.db.get(send.userId);
        return {
          ...send,
          id: send._id,
          user: user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
        };
      }),
    );

    // Sort by createdAt descending
    sendsWithUsers.sort((a, b) => b.createdAt - a.createdAt);

    return {
      ...emailSequence,
      id: emailSequence._id,
      sends: sendsWithUsers,
    };
  },
});

/**
 * Get participants who haven't received a specific email
 */
export const getUnsentParticipants = query({
  args: {
    emailSequenceId: v.id("emailSequences"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      return [];
    }

    // Get all participants in the challenge
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) =>
        q.eq("challengeId", emailSequence.challengeId),
      )
      .collect();

    // Get all sends for this sequence
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("emailSequenceId", (q) =>
        q.eq("emailSequenceId", args.emailSequenceId),
      )
      .collect();

    const sentUserIds = new Set(sends.map((s) => s.userId));

    // Filter to users who haven't received this email
    const unsentParticipations = participations.filter(
      (p) => !sentUserIds.has(p.userId),
    );

    // Get user data for unsent participants
    const result = await Promise.all(
      unsentParticipations.map(async (participation) => {
        const user = await ctx.db.get(participation.userId);
        return user
          ? {
              id: user._id,
              username: user.username,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              joinedAt: participation.joinedAt,
            }
          : null;
      }),
    );

    return result.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

/**
 * Get the base email template preview HTML (for admin UI)
 */
export const getEmailTemplatePreview = query({
  args: {},
  handler: async () => {
    return { html: getEmailTemplatePreviewHtml() };
  },
});

/**
 * Get the default email templates with info about which are already added
 */
export const getDefaultTemplates = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    // Get existing sequences for this challenge
    const existingSequences = await ctx.db
      .query("emailSequences")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const existingNames = new Set(existingSequences.map((s) => s.name));

    // Return default templates with added status
    return DEFAULT_EMAIL_PLAN.map((template) => ({
      name: template.name,
      subject: template.subject,
      trigger: template.trigger,
      sendOnDay: template.sendOnDay,
      alreadyAdded: existingNames.has(template.name),
    }));
  },
});
