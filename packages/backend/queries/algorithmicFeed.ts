import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";
import {
  FOLLOWING_BOOST,
  computeAffinityBoost,
  computeDecayedScore,
} from "../lib/feedScoring";

/**
 * Algorithmic feed: fetch the N most recent activities, then rank
 * purely by interestingness (content quality + engagement + social
 * relevance). No time decay — recency is handled by the candidate
 * window size.
 */
export const getAlgorithmicFeed = query({
  args: {
    challengeId: v.id("challenges"),
    includeEngagementCounts: v.optional(v.boolean()),
    includeMediaUrls: v.optional(v.boolean()),
    candidateLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const includeEngagementCounts = args.includeEngagementCounts ?? true;
    const includeMediaUrls = args.includeMediaUrls ?? true;
    const candidateLimit = Math.min(Math.max(args.candidateLimit ?? 200, 10), 500);
    const currentUser = await getCurrentUser(ctx);

    // Load viewer's following set and affinities.
    let followingIds: Set<string> | null = null;
    let affinityByAuthor: Map<string, number> | null = null;
    if (currentUser) {
      const [follows, affinities] = await Promise.all([
        ctx.db
          .query("follows")
          .withIndex("followerId", (q) => q.eq("followerId", currentUser._id))
          .collect(),
        ctx.db
          .query("userAffinities")
          .withIndex("challengeViewer", (q) =>
            q
              .eq("challengeId", args.challengeId)
              .eq("viewerUserId", currentUser._id),
          )
          .collect(),
      ]);
      followingIds = new Set(follows.map((f) => f.followingId));
      affinityByAuthor = new Map(
        affinities.map((affinity) => [affinity.authorUserId as string, affinity.score]),
      );
    }

    // Fetch most recent activities by creation time.
    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) =>
        q.eq("challengeId", args.challengeId),
      )
      .filter(notDeleted)
      .order("desc")
      .take(candidateLimit);

    // Hydrate each activity with user, type, engagement, media.
    const hydratedPage = await Promise.all(
      activities.map(async (activity) => {
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

        const [allLikes, commentCount] = includeEngagementCounts
          ? await Promise.all([
              ctx.db
                .query("likes")
                .withIndex("activityId", (q) =>
                  q.eq("activityId", activity._id),
                )
                .collect(),
              ctx.db
                .query("comments")
                .withIndex("activityId", (q) =>
                  q.eq("activityId", activity._id),
                )
                .collect()
                .then((rows) => rows.length),
            ])
          : [[] as Array<{ userId: typeof activity.userId; createdAt: number }>, 0];

        const likeCount = allLikes.length;

        // Fetch display info for the 2 most recent likers (for Instagram-style summary)
        const recentLikers = includeEngagementCounts && likeCount > 0
          ? await Promise.all(
              [...allLikes]
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 2)
                .map(async (like) => {
                  const likerUser = await ctx.db.get(like.userId);
                  if (!likerUser) return null;
                  return {
                    id: likerUser._id as string,
                    name: likerUser.name ?? null,
                    username: likerUser.username,
                  };
                }),
            ).then((arr) => arr.filter((u) => u !== null))
          : [];

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
        const affinityScore = affinityByAuthor
          ? affinityByAuthor.get(activity.userId as string) ?? 0
          : 0;

        const now = Date.now();
        const ageMs = now - activity.createdAt;
        const displayScore = computeDecayedScore(
          activity.feedScore ?? 0,
          ageMs,
          isFollowing,
          affinityScore,
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
          cloudinaryPublicIds: activity.cloudinaryPublicIds ?? [],
          recentLikers,
          displayScore,
          affinityScore,
          affinityBoost: computeAffinityBoost(affinityScore),
          followingBoost: isFollowing ? FOLLOWING_BOOST : 0,
        };
      }),
    );

    // Filter out null entries (deleted user/type), then sort by displayScore.
    const page = hydratedPage
      .filter((item) => item !== null)
      .sort((a, b) => b.displayScore - a.displayScore);

    return { page };
  },
});
