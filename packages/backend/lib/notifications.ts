/**
 * Notification helpers – dedup / rollup and batch insert.
 *
 * "Rollup" means: if a notification of the same type targeting the same
 * resource (activityId) already exists for this user within a recent window,
 * skip inserting a duplicate. This avoids spamming someone who gets 10 likes
 * in rapid succession.
 */

import type { Id } from "../_generated/dataModel";

/** Rollup window – 1 hour */
const ROLLUP_WINDOW_MS = 60 * 60 * 1000;

/** Notification types that should be deduped within the rollup window. */
const ROLLUP_TYPES = new Set(["like", "comment", "comment_like", "feedback_comment"]);

type Ctx = { db: any };

interface NotificationInsert {
  userId: Id<"users">;
  actorId: Id<"users">;
  type: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

/**
 * Insert a notification, respecting rollup rules for certain types.
 *
 * For types in ROLLUP_TYPES, if a notification with the same
 * (userId, type, data.activityId) already exists within the rollup window
 * we skip inserting.
 */
export async function insertNotification(
  ctx: Ctx,
  notification: NotificationInsert,
): Promise<Id<"notifications"> | null> {
  if (ROLLUP_TYPES.has(notification.type)) {
    const cutoff = notification.createdAt - ROLLUP_WINDOW_MS;
    const activityId = notification.data?.activityId;

    // Scan the user's recent notifications (desc order) and look for a match.
    const recent = await ctx.db
      .query("notifications")
      .withIndex("userId", (q: any) => q.eq("userId", notification.userId))
      .order("desc")
      .take(50);

    const isDuplicate = recent.some(
      (n: any) =>
        n.type === notification.type &&
        n.createdAt >= cutoff &&
        (activityId ? n.data?.activityId === activityId : true),
    );

    if (isDuplicate) {
      return null;
    }
  }

  return await ctx.db.insert("notifications", notification);
}
