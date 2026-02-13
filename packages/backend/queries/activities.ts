import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";

/**
 * Get a single activity by ID with all related data
 */
export const getById = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt) {
      return null;
    }

    const [user, activityType, challenge, likeCount, commentCount, currentUser] = await Promise.all([
      ctx.db.get(activity.userId),
      ctx.db.get(activity.activityTypeId),
      ctx.db.get(activity.challengeId),
      ctx.db
        .query("likes")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect()
        .then((likes) => likes.length),
      ctx.db
        .query("comments")
        .withIndex("activityId", (q) => q.eq("activityId", activity._id))
        .collect()
        .then((comments) => comments.length),
      getCurrentUser(ctx),
    ]);

    if (!user || !activityType || !challenge) {
      return null;
    }

    // Check like status
    let likedByUser = false;
    if (currentUser) {
      const userLike = await ctx.db
        .query("likes")
        .withIndex("activityUserUnique", (q) =>
          q.eq("activityId", activity._id).eq("userId", currentUser._id)
        )
        .first();
      likedByUser = userLike !== null;
    }

    const isOwner = currentUser ? currentUser._id === activity.userId : false;
    const isAdmin = currentUser
      ? currentUser.role === "admin" || challenge.creatorId === currentUser._id
      : false;

    // Gate admin comment visibility
    let adminComment: string | null = null;
    if (activity.adminComment) {
      if (
        activity.adminCommentVisibility === "participant" ||
        isOwner ||
        isAdmin
      ) {
        adminComment = activity.adminComment;
      }
    }

    // Get media URLs in parallel instead of sequentially
    const mediaUrls =
      activity.mediaIds && activity.mediaIds.length > 0
        ? (
            await Promise.all(
              activity.mediaIds.map((storageId) => ctx.storage.getUrl(storageId))
            )
          ).filter((url): url is string => url !== null)
        : [];

    return {
      activity,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      activityType: {
        id: activityType._id,
        name: activityType.name,
        categoryId: activityType.categoryId,
        scoringConfig: activityType.scoringConfig,
        isNegative: activityType.isNegative,
      },
      challenge: {
        id: challenge._id,
        name: challenge.name,
      },
      likes: likeCount,
      comments: commentCount,
      likedByUser,
      mediaUrls,
      adminComment,
      isOwner,
      isAdmin,
    };
  },
});

export const listByChallenge = internalQuery({
  args: {
    challengeId: v.id("challenges"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter(notDeleted)
      .take(limit);
  },
});

/**
 * Get activities for a challenge (feed)
 */
export const getChallengeFeed = query({
  args: {
    challengeId: v.id("challenges"),
    followingOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Resolve current user once (not per-item)
    const currentUser = await getCurrentUser(ctx);

    // Get following list if filtering
    let followingIds: Set<string> | null = null;
    if (args.followingOnly && currentUser) {
      const follows = await ctx.db
        .query("follows")
        .withIndex("followerId", (q) => q.eq("followerId", currentUser._id))
        .collect();
      followingIds = new Set(follows.map((f) => f.followingId));
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .filter(notDeleted)
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      activities.page.map(async (activity) => {
        // 3 parallel lookups per item (user, activityType, userLike) instead of 5
        const [user, activityType, userLike] = await Promise.all([
          ctx.db.get(activity.userId),
          ctx.db.get(activity.activityTypeId),
          currentUser
            ? ctx.db
                .query("likes")
                .withIndex("activityUserUnique", (q) =>
                  q.eq("activityId", activity._id).eq("userId", currentUser._id)
                )
                .first()
            : null,
        ]);

        // Count likes/comments via indexed first() + count pattern to avoid .collect()
        const [likeCount, commentCount] = await Promise.all([
          ctx.db
            .query("likes")
            .withIndex("activityId", (q) => q.eq("activityId", activity._id))
            .collect()
            .then((likes) => likes.length),
          ctx.db
            .query("comments")
            .withIndex("activityId", (q) => q.eq("activityId", activity._id))
            .collect()
            .then((comments) => comments.length),
        ]);

        // Get media URLs in parallel instead of sequentially
        const mediaUrls =
          activity.mediaIds && activity.mediaIds.length > 0
            ? (
                await Promise.all(
                  activity.mediaIds.map((storageId) => ctx.storage.getUrl(storageId))
                )
              ).filter((url): url is string => url !== null)
            : [];

        return {
          activity,
          user: user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null,
          activityType: activityType
            ? {
                id: activityType._id,
                name: activityType.name,
                categoryId: activityType.categoryId,
                scoringConfig: activityType.scoringConfig,
              }
            : null,
          likes: likeCount,
          comments: commentCount,
          likedByUser: userLike !== null,
          mediaUrls,
        };
      })
    );

    // Filter results
    let filteredPage = page.filter(
      (item) => item.user !== null && item.activityType !== null
    );

    // Apply following filter if enabled
    if (followingIds !== null) {
      filteredPage = filteredPage.filter(
        (item) => item.user && followingIds!.has(item.user.id)
      );
    }

    return {
      ...activities,
      page: filteredPage,
    };
  },
});

/**
 * Get media URLs for an activity
 */
export const getMediaUrls = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.deletedAt || !activity.mediaIds) {
      return [];
    }

    const urls = await Promise.all(
      activity.mediaIds.map((storageId) => ctx.storage.getUrl(storageId))
    );
    return urls.filter((url): url is string => url !== null);
  },
});

/**
 * Debug: Get recent activities with bonus info
 */
export const debugRecentActivities = query({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db
      .query("activities")
      .filter(notDeleted)
      .order("desc")
      .take(10);

    const result = await Promise.all(
      activities.map(async (a) => {
        const activityType = await ctx.db.get(a.activityTypeId);
        return {
          id: a._id,
          challengeId: a.challengeId,
          pointsEarned: a.pointsEarned,
          metrics: a.metrics,
          triggeredBonuses: a.triggeredBonuses,
          activityTypeName: activityType?.name,
          activityTypeBonusThresholds: (activityType as any)?.bonusThresholds,
          createdAt: a.createdAt,
        };
      })
    );

    return result;
  },
});

/**
 * Debug: Check user roles and challenge ownership
 */
export const debugUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const challenges = await ctx.db.query("challenges").collect();

    return {
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
      challenges: challenges.map((c) => ({
        id: c._id,
        name: c.name,
        creatorId: c.creatorId,
      })),
    };
  },
});

/**
 * Debug: Get achievements and user achievements
 */
export const debugAchievements = query({
  args: {},
  handler: async (ctx) => {
    const achievements = await ctx.db.query("achievements").collect();
    const userAchievements = await ctx.db.query("userAchievements").collect();

    return {
      achievements: achievements.map((a) => ({
        id: a._id,
        challengeId: a.challengeId,
        name: a.name,
        criteria: a.criteria,
        bonusPoints: a.bonusPoints,
        frequency: a.frequency,
      })),
      userAchievements: userAchievements.map((ua) => ({
        id: ua._id,
        achievementId: ua.achievementId,
        userId: ua.userId,
        earnedAt: ua.earnedAt,
      })),
    };
  },
});

