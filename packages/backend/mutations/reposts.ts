import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import { insertNotification } from "../lib/notifications";
import { recomputeFeedScore } from "../lib/feedScore";

export const toggle = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) {
      throw new Error("Activity not found");
    }

    const existing = await ctx.db
      .query("reposts")
      .withIndex("activityUserUnique", (q) =>
        q.eq("activityId", args.activityId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      // Unrepost
      await ctx.db.delete(existing._id);
      const newCount = Math.max(0, (activity.repostCount ?? 0) - 1);
      await ctx.db.patch(args.activityId, { repostCount: newCount });
      await recomputeFeedScore(ctx, args.activityId);
      return { reposted: false };
    } else {
      // Repost
      const now = Date.now();
      await ctx.db.insert("reposts", {
        activityId: args.activityId,
        userId: user._id,
        challengeId: activity.challengeId,
        createdAt: now,
      });

      const newCount = (activity.repostCount ?? 0) + 1;
      await ctx.db.patch(args.activityId, { repostCount: newCount });

      // Notify the original poster (skip self-reposts)
      if (activity.userId !== user._id) {
        await insertNotification(ctx, {
          userId: activity.userId,
          actorId: user._id,
          type: "repost",
          data: { activityId: args.activityId },
          createdAt: now,
        });
      }

      await recomputeFeedScore(ctx, args.activityId);
      return { reposted: true };
    }
  },
});
