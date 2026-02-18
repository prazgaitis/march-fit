import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { DEFAULT_EMAIL_PLAN } from "../lib/defaultEmailPlan";
import { getEmailTemplatePreviewHtml } from "../lib/emailTemplate";
import { coerceDateOnlyToString, dateOnlyToUtcMs } from "../lib/dateOnly";

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
 * List all email sends for a challenge with user and sequence info
 */
export const listSends = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by createdAt descending (most recent first)
    sends.sort((a, b) => b.createdAt - a.createdAt);

    // Batch-fetch related data
    const sequenceCache = new Map<string, Doc<"emailSequences"> | null>();
    const userCache = new Map<string, Doc<"users"> | null>();

    const result = await Promise.all(
      sends.map(async (send) => {
        if (!sequenceCache.has(send.emailSequenceId)) {
          sequenceCache.set(
            send.emailSequenceId,
            await ctx.db.get(send.emailSequenceId),
          );
        }
        if (!userCache.has(send.userId)) {
          userCache.set(send.userId, await ctx.db.get(send.userId));
        }

        const sequence = sequenceCache.get(send.emailSequenceId);
        const user = userCache.get(send.userId);

        return {
          id: send._id,
          status: send.status,
          error: send.error,
          createdAt: send.createdAt,
          sentAt: send.sentAt,
          emailName: sequence?.name ?? "Deleted email",
          subject: sequence?.subject ?? "",
          userName: user?.name || user?.username || "Unknown",
          userEmail: user?.email ?? "",
          userAvatarUrl: user?.avatarUrl,
        };
      }),
    );

    return result;
  },
});

/**
 * List all challenges for the "import participants" picker.
 * Excludes the current challenge. Returns id, name, dates, participant count.
 */
export const listChallengesForImport = query({
  args: {
    excludeChallengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const challenges = await ctx.db.query("challenges").collect();

    // Exclude the current challenge
    const filtered = challenges.filter(
      (c) => c._id !== args.excludeChallengeId,
    );

    // Sort by startDate descending (most recent first)
    filtered.sort(
      (a, b) => dateOnlyToUtcMs(b.startDate) - dateOnlyToUtcMs(a.startDate),
    );

    const result = await Promise.all(
      filtered.map(async (challenge) => {
        const participations = await ctx.db
          .query("userChallenges")
          .withIndex("challengeId", (q) =>
            q.eq("challengeId", challenge._id),
          )
          .collect();

        return {
          id: challenge._id,
          name: challenge.name,
          startDate: coerceDateOnlyToString(challenge.startDate),
          endDate: coerceDateOnlyToString(challenge.endDate),
          participantCount: participations.length,
        };
      }),
    );

    return result;
  },
});

/**
 * Get participants from another challenge for importing into an email send.
 * Returns user info and whether they've already been sent this email.
 */
export const getOtherChallengeParticipants = query({
  args: {
    emailSequenceId: v.id("emailSequences"),
    sourceChallengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) return [];

    // Get participants from the source challenge
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q) =>
        q.eq("challengeId", args.sourceChallengeId),
      )
      .collect();

    // Get existing sends for this email sequence
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("emailSequenceId", (q) =>
        q.eq("emailSequenceId", args.emailSequenceId),
      )
      .collect();

    const sentUserIds = new Set(sends.map((s) => s.userId));

    // Get user data
    const result = await Promise.all(
      participations.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        if (!user) return null;
        return {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          alreadySent: sentUserIds.has(user._id),
        };
      }),
    );

    return result.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

/**
 * Look up users by a list of email addresses and check if they've already
 * received a specific email sequence.
 */
export const getUsersByEmailsCsv = query({
  args: {
    emailSequenceId: v.id("emailSequences"),
    emails: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Deduplicate emails on the backend as well
    const uniqueEmails = Array.from(new Set(args.emails.map((e) => e.toLowerCase().trim())));

    // Get existing sends for this email sequence (for alreadySent check)
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("emailSequenceId", (q) =>
        q.eq("emailSequenceId", args.emailSequenceId),
      )
      .collect();

    const sentUserIds = new Set(sends.map((s) => s.userId));

    const matched: Array<{
      id: string;
      username: string;
      name?: string;
      email: string;
      avatarUrl?: string;
      alreadySent: boolean;
    }> = [];
    const notFound: string[] = [];

    for (const email of uniqueEmails) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();

      if (!user) {
        notFound.push(email);
      } else {
        matched.push({
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          alreadySent: sentUserIds.has(user._id),
        });
      }
    }

    return { matched, notFound };
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
