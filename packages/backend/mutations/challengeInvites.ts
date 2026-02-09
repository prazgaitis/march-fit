import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";
import { resend } from "../lib/resend";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get or create an invite code for the current user in a challenge.
 * Returns the existing code if one already exists.
 */
export const getOrCreateInviteCode = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check user is a participant
    const participation = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (!participation) {
      throw new Error("Not participating in this challenge");
    }

    // Check if invite code already exists
    const existing = await ctx.db
      .query("challengeInvites")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (existing) {
      return existing.code;
    }

    // Generate a unique code
    let code = generateInviteCode();
    // Check for collision (very unlikely with 8 chars from 55-char alphabet)
    let existingCode = await ctx.db
      .query("challengeInvites")
      .withIndex("code", (q) => q.eq("code", code))
      .first();
    while (existingCode) {
      code = generateInviteCode();
      existingCode = await ctx.db
        .query("challengeInvites")
        .withIndex("code", (q) => q.eq("code", code))
        .first();
    }

    await ctx.db.insert("challengeInvites", {
      challengeId: args.challengeId,
      userId: user._id,
      code,
      createdAt: Date.now(),
    });

    return code;
  },
});

const DEFAULT_FROM_EMAIL = "March Fitness <noreply@march.fit>";

/**
 * Send invite emails to a list of email addresses.
 * Gets or creates the user's invite code and sends a branded email via Resend.
 */
export const sendInviteEmails = mutation({
  args: {
    challengeId: v.id("challenges"),
    emails: v.array(v.string()),
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Cap at 10 emails per call
    const emails = args.emails.slice(0, 10);

    if (emails.length === 0) {
      return { sentCount: 0, failedCount: 0 };
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Get or create invite code (inline pattern from getOrCreateInviteCode)
    let invite = await ctx.db
      .query("challengeInvites")
      .withIndex("userChallengeUnique", (q) =>
        q.eq("userId", user._id).eq("challengeId", args.challengeId)
      )
      .first();

    if (!invite) {
      let code = generateInviteCode();
      let existingCode = await ctx.db
        .query("challengeInvites")
        .withIndex("code", (q) => q.eq("code", code))
        .first();
      while (existingCode) {
        code = generateInviteCode();
        existingCode = await ctx.db
          .query("challengeInvites")
          .withIndex("code", (q) => q.eq("code", code))
          .first();
      }
      const inviteId = await ctx.db.insert("challengeInvites", {
        challengeId: args.challengeId,
        userId: user._id,
        code,
        createdAt: Date.now(),
      });
      invite = await ctx.db.get(inviteId);
    }

    const inviteUrl = `${args.origin}/challenges/${args.challengeId}/invite/${invite!.code}`;
    const inviterName = user.name || user.username;

    let sentCount = 0;
    let failedCount = 0;

    for (const email of emails) {
      try {
        await resend.sendEmail(ctx, {
          from: DEFAULT_FROM_EMAIL,
          to: email.trim(),
          subject: `${inviterName} invited you to ${challenge.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="margin: 0 0 8px;">You're invited!</h2>
              <p style="color: #555; margin: 0 0 16px;">
                <strong>${inviterName}</strong> wants you to join <strong>${challenge.name}</strong> on March Fitness.
              </p>
              <a href="${inviteUrl}"
                 style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Join the challenge
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 24px;">
                Or copy this link: ${inviteUrl}
              </p>
            </div>
          `,
        });
        sentCount++;
      } catch {
        failedCount++;
      }
    }

    return { sentCount, failedCount };
  },
});
