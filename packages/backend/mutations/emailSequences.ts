import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { resend } from "../lib/resend";
import { DEFAULT_EMAIL_PLAN } from "../lib/defaultEmailPlan";
import { DEFAULT_FROM_EMAIL } from "../lib/emailTemplate";
import { getCurrentUser } from "../lib/ids";

// Helper to check if user is challenge admin
async function requireChallengeAdmin(
  ctx: { db: any; auth: any },
  challengeId: Id<"challenges">,
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
 * Create a new email sequence
 */
export const create = mutation({
  args: {
    challengeId: v.id("challenges"),
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    bodySource: v.optional(v.string()),
    trigger: v.union(v.literal("manual"), v.literal("on_signup")),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const now = Date.now();

    const emailSequenceId = await ctx.db.insert("emailSequences", {
      challengeId: args.challengeId,
      name: args.name,
      subject: args.subject,
      body: args.body,
      bodySource: args.bodySource,
      trigger: args.trigger,
      enabled: args.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return { emailSequenceId };
  },
});

/**
 * Update an email sequence
 */
export const update = mutation({
  args: {
    emailSequenceId: v.id("emailSequences"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    bodySource: v.optional(v.string()),
    trigger: v.optional(v.union(v.literal("manual"), v.literal("on_signup"))),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      throw new Error("Email sequence not found");
    }

    await requireChallengeAdmin(ctx, emailSequence.challengeId);

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.subject !== undefined) updates.subject = args.subject;
    if (args.body !== undefined) updates.body = args.body;
    if (args.bodySource !== undefined) updates.bodySource = args.bodySource;
    if (args.trigger !== undefined) updates.trigger = args.trigger;
    if (args.enabled !== undefined) updates.enabled = args.enabled;

    await ctx.db.patch(args.emailSequenceId, updates);

    return { success: true };
  },
});

/**
 * Delete an email sequence
 */
export const remove = mutation({
  args: {
    emailSequenceId: v.id("emailSequences"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      throw new Error("Email sequence not found");
    }

    await requireChallengeAdmin(ctx, emailSequence.challengeId);

    // Delete all related email sends
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("emailSequenceId", (q: any) =>
        q.eq("emailSequenceId", args.emailSequenceId),
      )
      .collect();

    for (const send of sends) {
      await ctx.db.delete(send._id);
    }

    await ctx.db.delete(args.emailSequenceId);

    return { success: true };
  },
});

/**
 * Apply the default email plan to a challenge
 * Creates email sequences from the default templates
 */
export const applyDefaultPlan = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const now = Date.now();
    const created: string[] = [];
    const skipped: string[] = [];

    // Check existing sequences to avoid duplicates
    const existingSequences = await ctx.db
      .query("emailSequences")
      .withIndex("challengeId", (q: any) => q.eq("challengeId", args.challengeId))
      .collect();

    const existingNames = new Set(existingSequences.map((s: any) => s.name));

    for (const template of DEFAULT_EMAIL_PLAN) {
      // Skip if a sequence with this name already exists
      if (existingNames.has(template.name)) {
        skipped.push(template.name);
        continue;
      }

      await ctx.db.insert("emailSequences", {
        challengeId: args.challengeId,
        name: template.name,
        subject: template.subject,
        body: template.body,
        trigger: template.trigger,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      created.push(template.name);
    }

    return { created, skipped };
  },
});

/**
 * Add a single template from the default email plan
 */
export const addDefaultTemplate = mutation({
  args: {
    challengeId: v.id("challenges"),
    templateName: v.string(),
  },
  handler: async (ctx, args) => {
    await requireChallengeAdmin(ctx, args.challengeId);

    const template = DEFAULT_EMAIL_PLAN.find((t) => t.name === args.templateName);
    if (!template) {
      throw new Error(`Template "${args.templateName}" not found`);
    }

    const now = Date.now();

    const emailSequenceId = await ctx.db.insert("emailSequences", {
      challengeId: args.challengeId,
      name: template.name,
      subject: template.subject,
      body: template.body,
      trigger: template.trigger,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });

    return { emailSequenceId, name: template.name };
  },
});

/**
 * Send a test email to a specific user without recording it.
 * The user remains in the "unsent" list so they still receive the real send.
 */
export const sendTest = mutation({
  args: {
    emailSequenceId: v.id("emailSequences"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      throw new Error("Email sequence not found");
    }

    await requireChallengeAdmin(ctx, emailSequence.challengeId);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await resend.sendEmail(ctx, {
      from: DEFAULT_FROM_EMAIL,
      to: user.email,
      subject: `[TEST] ${emailSequence.subject}`,
      html: emailSequence.body,
    });

    return { success: true };
  },
});

/**
 * Send an email to a specific user (manual trigger)
 */
export const sendToUser = mutation({
  args: {
    emailSequenceId: v.id("emailSequences"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      throw new Error("Email sequence not found");
    }

    await requireChallengeAdmin(ctx, emailSequence.challengeId);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if already sent to this user
    const existingSend = await ctx.db
      .query("emailSends")
      .withIndex("userSequence", (q: any) =>
        q.eq("userId", args.userId).eq("emailSequenceId", args.emailSequenceId),
      )
      .first();

    if (existingSend) {
      throw new Error("Email already sent to this user");
    }

    const now = Date.now();

    // Create pending email send record
    const sendId = await ctx.db.insert("emailSends", {
      emailSequenceId: args.emailSequenceId,
      userId: args.userId,
      challengeId: emailSequence.challengeId,
      status: "pending",
      createdAt: now,
    });

    try {
      // Send the email via Resend component
      await resend.sendEmail(ctx, {
        from: DEFAULT_FROM_EMAIL,
        to: user.email,
        subject: emailSequence.subject,
        html: emailSequence.body,
      });

      await ctx.db.patch(sendId, {
        status: "sent",
        sentAt: Date.now(),
      });
    } catch (error) {
      await ctx.db.patch(sendId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }

    return { sendId };
  },
});

/**
 * Send an email to all participants in the challenge
 */
export const sendToAll = mutation({
  args: {
    emailSequenceId: v.id("emailSequences"),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      throw new Error("Email sequence not found");
    }

    await requireChallengeAdmin(ctx, emailSequence.challengeId);

    // Get all participants
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q: any) =>
        q.eq("challengeId", emailSequence.challengeId),
      )
      .collect();

    const now = Date.now();
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const participation of participations) {
      // Check if already sent to this user
      const existingSend = await ctx.db
        .query("emailSends")
        .withIndex("userSequence", (q: any) =>
          q
            .eq("userId", participation.userId)
            .eq("emailSequenceId", args.emailSequenceId),
        )
        .first();

      if (existingSend) {
        skippedCount++;
        continue;
      }

      // Get user email
      const user = await ctx.db.get(participation.userId);
      if (!user) {
        skippedCount++;
        continue;
      }

      // Create pending email send record
      const sendId = await ctx.db.insert("emailSends", {
        emailSequenceId: args.emailSequenceId,
        userId: participation.userId,
        challengeId: emailSequence.challengeId,
        status: "pending",
        createdAt: now,
      });

      try {
        // Send the email via Resend component
        await resend.sendEmail(ctx, {
          from: DEFAULT_FROM_EMAIL,
          to: user.email,
          subject: emailSequence.subject,
          html: emailSequence.body,
        });

        await ctx.db.patch(sendId, {
          status: "sent",
          sentAt: Date.now(),
        });
        sentCount++;
      } catch (error) {
        await ctx.db.patch(sendId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        failedCount++;
      }
    }

    return { sentCount, skippedCount, failedCount };
  },
});

/**
 * Send an email to a specific list of users (e.g. imported from another challenge).
 * Creates emailSends records and sends via Resend.
 */
export const sendToUsers = mutation({
  args: {
    emailSequenceId: v.id("emailSequences"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const emailSequence = await ctx.db.get(args.emailSequenceId);
    if (!emailSequence) {
      throw new Error("Email sequence not found");
    }

    await requireChallengeAdmin(ctx, emailSequence.challengeId);

    const now = Date.now();
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const userId of args.userIds) {
      // Check if already sent to this user
      const existingSend = await ctx.db
        .query("emailSends")
        .withIndex("userSequence", (q: any) =>
          q.eq("userId", userId).eq("emailSequenceId", args.emailSequenceId),
        )
        .first();

      if (existingSend) {
        skippedCount++;
        continue;
      }

      // Get user email
      const user = await ctx.db.get(userId);
      if (!user) {
        skippedCount++;
        continue;
      }

      // Create pending email send record
      const sendId = await ctx.db.insert("emailSends", {
        emailSequenceId: args.emailSequenceId,
        userId,
        challengeId: emailSequence.challengeId,
        status: "pending",
        createdAt: now,
      });

      try {
        await resend.sendEmail(ctx, {
          from: DEFAULT_FROM_EMAIL,
          to: user.email,
          subject: emailSequence.subject,
          html: emailSequence.body,
        });

        await ctx.db.patch(sendId, {
          status: "sent",
          sentAt: Date.now(),
        });
        sentCount++;
      } catch (error) {
        await ctx.db.patch(sendId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        failedCount++;
      }
    }

    return { sentCount, skippedCount, failedCount };
  },
});

/**
 * Internal mutation to send email on signup (called from participations mutation)
 */
export const triggerOnSignup = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get enabled on_signup emails for this challenge
    const emailSequences = await ctx.db
      .query("emailSequences")
      .withIndex("challengeTrigger", (q: any) =>
        q.eq("challengeId", args.challengeId).eq("trigger", "on_signup"),
      )
      .collect();

    const enabledSequences = emailSequences.filter((seq: any) => seq.enabled);

    if (enabledSequences.length === 0) {
      return { sent: 0 };
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { sent: 0 };
    }

    const now = Date.now();
    let sent = 0;

    for (const sequence of enabledSequences) {
      // Check if already sent to this user
      const existingSend = await ctx.db
        .query("emailSends")
        .withIndex("userSequence", (q: any) =>
          q.eq("userId", args.userId).eq("emailSequenceId", sequence._id),
        )
        .first();

      if (existingSend) {
        continue;
      }

      // Create email send record
      const sendId = await ctx.db.insert("emailSends", {
        emailSequenceId: sequence._id,
        userId: args.userId,
        challengeId: args.challengeId,
        status: "pending",
        createdAt: now,
      });

      try {
        // Send the email via Resend component
        await resend.sendEmail(ctx, {
          from: DEFAULT_FROM_EMAIL,
          to: user.email,
          subject: sequence.subject,
          html: sequence.body,
        });

        await ctx.db.patch(sendId, {
          status: "sent",
          sentAt: Date.now(),
        });
        sent++;
      } catch (error) {
        await ctx.db.patch(sendId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't throw - we don't want to fail the signup because of email issues
        console.error("Failed to send signup email:", error);
      }
    }

    return { sent };
  },
});
