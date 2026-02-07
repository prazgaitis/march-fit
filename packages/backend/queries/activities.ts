import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUser } from "../lib/ids";

/**
 * Get a single activity by ID with all related data
 */
export const getById = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      return null;
    }

    const [user, activityType, challenge, likeCount, commentCount, userLike] = await Promise.all([
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
      getCurrentUser(ctx).then(async (currentUser) => {
        if (!currentUser) return null;

        return ctx.db
          .query("likes")
          .withIndex("activityUserUnique", (q) =>
            q.eq("activityId", activity._id).eq("userId", currentUser._id)
          )
          .first();
      }),
    ]);

    if (!user || !activityType || !challenge) {
      return null;
    }

    // Get media URLs from storage IDs
    const mediaUrls: string[] = [];
    if (activity.mediaIds && activity.mediaIds.length > 0) {
      for (const storageId of activity.mediaIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (url) {
          mediaUrls.push(url);
        }
      }
    }

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
      likedByUser: userLike !== null,
      mediaUrls,
    };
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
    // Get current user's following list if filtering
    let followingIds: Set<string> | null = null;
    if (args.followingOnly) {
      const currentUser = await getCurrentUser(ctx);
      if (currentUser) {
        const follows = await ctx.db
          .query("follows")
          .withIndex("followerId", (q) => q.eq("followerId", currentUser._id))
          .collect();

        followingIds = new Set(follows.map((f) => f.followingId));
      }
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      activities.page.map(async (activity) => {
        const [user, activityType, likeCount, commentCount, likes] = await Promise.all([
          ctx.db.get(activity.userId),
          ctx.db.get(activity.activityTypeId),
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
          getCurrentUser(ctx).then(async (currentUser) => {
            if (!currentUser) return [];

            return ctx.db
                .query("likes")
                .withIndex("activityUserUnique", (q) =>
                    q.eq("activityId", activity._id).eq("userId", currentUser._id)
                )
                .collect();
          }),
        ]);

        // Get media URLs from storage IDs
        const mediaUrls: string[] = [];
        if (activity.mediaIds && activity.mediaIds.length > 0) {
          for (const storageId of activity.mediaIds) {
            const url = await ctx.storage.getUrl(storageId);
            if (url) {
              mediaUrls.push(url);
            }
          }
        }

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
          likedByUser: likes.length > 0,
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
    if (!activity || !activity.mediaIds) {
      return [];
    }

    const urls: string[] = [];
    for (const storageId of activity.mediaIds) {
      const url = await ctx.storage.getUrl(storageId);
      if (url) {
        urls.push(url);
      }
    }
    return urls;
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



