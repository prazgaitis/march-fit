import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { resend } from "../lib/resend";
import { DEFAULT_FROM_EMAIL } from "../lib/emailTemplate";
import {
  getEmailPreferenceField,
  getNotificationEmailSubject,
  getNotificationEmailHtml,
} from "../lib/notificationEmails";

/**
 * Internal mutation to send a notification email if the user has opted in.
 * Called after inserting a notification.
 */
export const maybeSendEmail = internalMutation({
  args: {
    userId: v.id("users"),
    actorId: v.id("users"),
    type: v.string(),
    data: v.optional(v.any()),
    challengeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Don't email users about their own actions
    if (args.userId === args.actorId) {
      return { sent: false, reason: "self_action" };
    }

    // Check which preference field maps to this notification type
    const prefField = getEmailPreferenceField(args.type);
    if (!prefField) {
      return { sent: false, reason: "unmapped_type" };
    }

    // Look up user preferences
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("userId", (q: any) => q.eq("userId", args.userId))
      .first();

    // If no preferences record or this category is disabled, skip
    if (!prefs || !prefs[prefField]) {
      return { sent: false, reason: "not_enabled" };
    }

    // Get user and actor
    const [user, actor] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.actorId),
    ]);

    if (!user || !actor) {
      return { sent: false, reason: "user_not_found" };
    }

    const actorName = actor.name || actor.username || "Someone";
    const subject = getNotificationEmailSubject(args.type, actorName);
    const html = getNotificationEmailHtml(
      args.type,
      actorName,
      args.data as Record<string, unknown> | undefined,
      args.challengeId,
    );

    try {
      await resend.sendEmail(ctx, {
        from: DEFAULT_FROM_EMAIL,
        to: user.email,
        subject,
        html,
      });
      return { sent: true };
    } catch (error) {
      console.error("Failed to send notification email:", error);
      return { sent: false, reason: "send_failed" };
    }
  },
});
