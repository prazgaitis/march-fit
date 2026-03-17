import { internalMutation, mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";
import { recomputeFeedScore } from "../lib/feedScore";

/**
 * Background job: find and link related activities for tagged users.
 *
 * For each tag on the activity, search for non-deleted activities by
 * the tagged user in the same challenge on the same loggedDate.
 * If found, set relatedActivityId on the tag record.
 */
export const linkRelatedActivities = internalMutation({
  args: {
    activityId: v.id("activities"),
    challengeId: v.id("challenges"),
    loggedDate: v.number(),
  },
  handler: async (ctx, args) => {
    const tags = await ctx.db
      .query("activityTags")
      .withIndex("activityId", (q) => q.eq("activityId", args.activityId))
      .collect();

    for (const tag of tags) {
      if (tag.relatedActivityId) continue; // Already linked

      // Search for the tagged user's own activity on the same date
      const relatedActivities = await ctx.db
        .query("activities")
        .withIndex("by_user_challenge_date", (q) =>
          q
            .eq("userId", tag.taggedUserId)
            .eq("challengeId", args.challengeId)
            .eq("loggedDate", args.loggedDate),
        )
        .filter(notDeleted)
        .collect();

      if (relatedActivities.length > 0) {
        // Link to the first matching activity (most relevant)
        await ctx.db.patch(tag._id, {
          relatedActivityId: relatedActivities[0]._id,
        });
      }
    }

    // Recompute feed score for the tagged activity (tag boost)
    await recomputeFeedScore(ctx, args.activityId);
  },
});

/**
 * Dismiss a tagged activity from the tagged user's feed.
 * Only the tagged user can dismiss their own tag.
 */
export const dismiss = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const tag = await ctx.db
      .query("activityTags")
      .withIndex("activityTaggedUser", (q) =>
        q.eq("activityId", args.activityId).eq("taggedUserId", user._id),
      )
      .first();

    if (!tag) {
      throw new ConvexError("You are not tagged in this activity.");
    }

    if (tag.dismissedAt) {
      return { success: true }; // Already dismissed
    }

    await ctx.db.patch(tag._id, {
      dismissedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Remove a tag from an activity. Only the activity owner or tagged user can do this.
 */
export const removeTag = mutation({
  args: {
    activityId: v.id("activities"),
    taggedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) {
      throw new ConvexError("Activity not found.");
    }

    // Only the activity owner or the tagged user can remove a tag
    const canRemove =
      user._id === activity.userId || user._id === args.taggedUserId;
    if (!canRemove) {
      throw new ConvexError("You don't have permission to remove this tag.");
    }

    const tag = await ctx.db
      .query("activityTags")
      .withIndex("activityTaggedUser", (q) =>
        q.eq("activityId", args.activityId).eq("taggedUserId", args.taggedUserId),
      )
      .first();

    if (!tag) {
      return { success: true }; // Already removed
    }

    await ctx.db.delete(tag._id);

    // Recompute feed score (tag count changed)
    await recomputeFeedScore(ctx, args.activityId);

    return { success: true };
  },
});
