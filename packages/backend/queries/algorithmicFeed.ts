import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";
import { computePersonalizedRank } from "../lib/feedScoring";

/**
 * Algorithmic feed: activities ranked by content quality, engagement,
 * social relevance (following), and recency.
 *
 * Uses the `challengeFeedRank` index for efficient page fetches
 * (time-bucketed: today's posts always above yesterday's), then
 * applies per-viewer following boost and re-sorts within each page.
 */
export const getAlgorithmicFeed = query({
  args: {
    challengeId: v.id("challenges"),
    includeEngagementCounts: v.optional(v.boolean()),
    includeMediaUrls: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const includeEngagementCounts = args.includeEngagementCounts ?? true;
    const includeMediaUrls = args.includeMediaUrls ?? true;
    const currentUser = await getCurrentUser(ctx);

    // Load viewer's following set (cheap — typically < 200 rows).
    let followingIds: Set<string> | null = null;
    if (currentUser) {
      const follows = await ctx.db
        .query("follows")
        .withIndex("followerId", (q) => q.eq("followerId", currentUser._id))
        .collect();
      followingIds = new Set(follows.map((f) => f.followingId));
    }

    // Paginate by feedRank DESC via index.
    // Activities without a feedRank (pre-backfill) have feedRank = undefined
    // and won't appear in this index scan — that's intentional; the backfill
    // will fill them in and they'll start appearing.
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeFeedRank", (q) =>
        q.eq("challengeId", args.challengeId),
      )
      .filter(notDeleted)
      .order("desc")
      .paginate(args.paginationOpts);

    // Hydrate each activity with user, type, engagement, media.
    const hydratedPage = await Promise.all(
      activities.page.map(async (activity) => {
        const [user, activityType, userLike] = await Promise.all([
          ctx.db.get(activity.userId),
          ctx.db.get(activity.activityTypeId),
          currentUser
            ? ctx.db
                .query("likes")
                .withIndex("activityUserUnique", (q) =>
                  q
                    .eq("activityId", activity._id)
                    .eq("userId", currentUser._id),
                )
                .first()
            : null,
        ]);

        if (!user || !activityType) return null;

        const [likeCount, commentCount] = includeEngagementCounts
          ? await Promise.all([
              ctx.db
                .query("likes")
                .withIndex("activityId", (q) =>
                  q.eq("activityId", activity._id),
                )
                .collect()
                .then((rows) => rows.length),
              ctx.db
                .query("comments")
                .withIndex("activityId", (q) =>
                  q.eq("activityId", activity._id),
                )
                .collect()
                .then((rows) => rows.length),
            ])
          : [0, 0];

        const mediaUrls =
          includeMediaUrls && activity.mediaIds && activity.mediaIds.length > 0
            ? (
                await Promise.all(
                  activity.mediaIds.map((storageId) =>
                    ctx.storage.getUrl(storageId),
                  ),
                )
              ).filter((url): url is string => url !== null)
            : [];

        const isFollowing = followingIds
          ? followingIds.has(activity.userId as string)
          : false;

        const displayScore = computePersonalizedRank(
          activity.feedRank ?? 0,
          isFollowing,
        );

        return {
          activity,
          user: {
            id: user._id,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
            location: user.location ?? null,
          },
          activityType: {
            id: activityType._id,
            name: activityType.name,
            categoryId: activityType.categoryId,
            scoringConfig: activityType.scoringConfig,
            isNegative: activityType.isNegative,
          },
          likes: likeCount,
          comments: commentCount,
          likedByUser: userLike !== null,
          mediaUrls,
          displayScore,
        };
      }),
    );

    // Filter out null entries (deleted user/type), then re-sort by displayScore.
    const page = hydratedPage
      .filter((item) => item !== null)
      .sort((a, b) => b.displayScore - a.displayScore);

    return {
      ...activities,
      page,
    };
  },
});
