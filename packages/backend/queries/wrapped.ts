import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/ids";
import { notDeleted } from "../lib/activityFilters";
import { formatDateOnlyFromUtcMs } from "../lib/dateOnly";

// ─── Types ───────────────────────────────────────────────────────────────────

type WrappedData = {
  userName: string;
  avatarUrl: string | null;
  challengeName: string;

  // Final Standing
  totalPoints: number;
  rank: number;
  totalParticipants: number;

  // Activity Volume
  totalActivities: number;
  avgActivitiesPerParticipant: number;

  // Streak
  currentStreak: number;

  // Favorite Activity
  favoriteActivity: { name: string; count: number; totalPoints: number } | null;
  activityVariety: number;

  // Distance + Time + Elevation
  totalDistanceMiles: number;
  totalMinutes: number;
  totalElevationMeters: number;

  // PR Day
  prDay: {
    date: string;
    points: number;
    activities: Array<{ name: string; points: number }>;
  } | null;

  // Weekly Progression
  weeklyPoints: Array<{ week: number; points: number }>;

  // Time of Day
  activityTimeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  mostCommonTime: "morning" | "afternoon" | "evening" | "night";

  // Category Breakdown
  categoryBreakdown: Array<{
    name: string;
    points: number;
    percentage: number;
  }>;

  // Bonus Milestones
  bonusMilestones: Array<{ description: string; count: number }>;

  // Social - Likes
  likesGiven: number;
  likesReceived: number;

  // Biggest Fan + Your Favorite
  biggestFan: {
    name: string;
    avatarUrl: string | null;
    score: number;
  } | null;
  yourFavorite: {
    name: string;
    avatarUrl: string | null;
    score: number;
  } | null;

  // Most Popular Activity
  mostPopularActivity: {
    points: number;
    likes: number;
    activityTypeName: string;
    date: string;
  } | null;

  // Social Summary
  commentsGiven: number;
  commentsReceived: number;
  pokesSent: number;
  pokesReceived: number;
  forumPosts: number;
  forumReplies: number;

  // Mini-Games
  miniGameResults: Array<{
    type: string;
    partnerName?: string;
    outcome: string;
    bonusPoints: number;
  }>;

  // Achievements + Badges
  achievementsEarned: Array<{ name: string; description: string }>;
  badgesEarned: Array<{
    name: string;
    icon: string | null;
    imagePublicId: string | null;
  }>;

  // Fun Stats
  photosShared: number;
  drinkPenalties: number;
  drinkPenaltyPoints: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeBucket(
  localTime: string | undefined
): "morning" | "afternoon" | "evening" | "night" {
  if (!localTime) return "morning";
  const hour = parseInt(localTime.split(":")[0], 10);
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function getDistanceMiles(metrics: Record<string, unknown>): number {
  const miles =
    Number(metrics.miles) ||
    Number(metrics.distance_miles) ||
    Number(metrics.distance) ||
    0;
  if (miles > 0) return miles;
  const km =
    Number(metrics.kilometers) ||
    Number(metrics.km) ||
    Number(metrics.distance_km) ||
    0;
  if (km > 0) return km * 0.621371;
  return 0;
}

function getMinutes(metrics: Record<string, unknown>): number {
  return (
    Number(metrics.minutes) ||
    Number(metrics.duration_minutes) ||
    Number(metrics.duration) ||
    0
  );
}

function getElevationMeters(metrics: Record<string, unknown>): number {
  const meters =
    Number(metrics.elevation_gain_m) ||
    Number(metrics.elevation_gain_meters) ||
    0;
  if (meters > 0) return meters;
  const feet =
    Number(metrics.elevation_gain_feet) ||
    Number(metrics.elevation_gain_ft) ||
    0;
  if (feet > 0) return feet * 0.3048;
  return 0;
}

// ─── Core computation ────────────────────────────────────────────────────────

async function computeWrappedData(
  ctx: any,
  userId: Id<"users">,
  challengeId: Id<"challenges">
): Promise<WrappedData | null> {
  const [user, challenge, participation] = await Promise.all([
    ctx.db.get(userId),
    ctx.db.get(challengeId),
    ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", userId).eq("challengeId", challengeId)
      )
      .first(),
  ]);

  if (!user || !challenge || !participation) return null;

  // ── Rank ──────────────────────────────────────────────────────────────────
  const allParticipations = await ctx.db
    .query("userChallenges")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  const sorted = allParticipations.sort(
    (a: any, b: any) => b.totalPoints - a.totalPoints
  );
  const rank = sorted.findIndex((p: any) => p.userId === userId) + 1;

  // ── Activities ────────────────────────────────────────────────────────────
  const allActivities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .filter((q: any) => notDeleted(q))
    .collect();

  // Filter to user-logged activities (exclude system-generated bonuses)
  const userActivities = allActivities.filter(
    (a: any) =>
      a.source === "manual" || a.source === "strava" || a.source === "apple_health"
  );

  const totalParticipants = allParticipations.length;

  // ── Activity Type names lookup ────────────────────────────────────────────
  const activityTypeIds = Array.from(
    new Set(userActivities.map((a: any) => a.activityTypeId as string))
  );
  const activityTypes = await Promise.all(
    activityTypeIds.map((id) => ctx.db.get(id as Id<"activityTypes">))
  );
  const typeMap = new Map<string, any>();
  for (const at of activityTypes) {
    if (at) typeMap.set(at._id, at);
  }

  // ── Aggregate activity stats ──────────────────────────────────────────────
  let totalDistanceMiles = 0;
  let totalMinutes = 0;
  let totalElevationMeters = 0;
  let photosShared = 0;
  let drinkPenalties = 0;
  let drinkPenaltyPoints = 0;

  const typeCountMap = new Map<string, { count: number; points: number }>();
  const dailyPoints = new Map<
    string,
    { points: number; activities: Array<{ name: string; points: number }> }
  >();
  const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const bonusCounts = new Map<string, number>();

  for (const activity of userActivities) {
    const metrics = (activity.metrics ?? {}) as Record<string, unknown>;
    const at = typeMap.get(activity.activityTypeId);

    totalDistanceMiles += getDistanceMiles(metrics);
    totalMinutes += getMinutes(metrics);
    totalElevationMeters += getElevationMeters(metrics);

    // Photos
    if (activity.cloudinaryPublicIds?.length > 0) {
      photosShared++;
    }

    // Drink penalties
    if (at?.isNegative) {
      drinkPenalties++;
      drinkPenaltyPoints += Math.abs(activity.pointsEarned ?? 0);
    }

    // Type counts
    const typeId = activity.activityTypeId as string;
    const existing = typeCountMap.get(typeId) ?? { count: 0, points: 0 };
    existing.count++;
    existing.points += activity.pointsEarned ?? 0;
    typeCountMap.set(typeId, existing);

    // Daily points (for PR day)
    const dateStr = formatDateOnlyFromUtcMs(activity.loggedDate);
    const day = dailyPoints.get(dateStr) ?? { points: 0, activities: [] };
    day.points += activity.pointsEarned ?? 0;
    day.activities.push({
      name: at?.name ?? "Unknown",
      points: activity.pointsEarned ?? 0,
    });
    dailyPoints.set(dateStr, day);

    // Time of day
    timeBuckets[getTimeBucket(activity.localTime)]++;

    // Triggered bonuses
    if (activity.triggeredBonuses) {
      for (const bonus of activity.triggeredBonuses) {
        if (bonus.description && bonus.metric !== "media") {
          const count = bonusCounts.get(bonus.description) ?? 0;
          bonusCounts.set(bonus.description, count + 1);
        }
      }
    }
  }

  // Favorite activity
  let favoriteActivity: WrappedData["favoriteActivity"] = null;
  let maxCount = 0;
  for (const [typeId, stats] of typeCountMap) {
    const at = typeMap.get(typeId);
    if (at && !at.isNegative && stats.count > maxCount) {
      maxCount = stats.count;
      favoriteActivity = {
        name: at.name,
        count: stats.count,
        totalPoints: Math.round(stats.points),
      };
    }
  }

  // PR Day
  let prDay: WrappedData["prDay"] = null;
  let maxDayPoints = 0;
  for (const [date, day] of dailyPoints) {
    if (day.points > maxDayPoints) {
      maxDayPoints = day.points;
      prDay = {
        date,
        points: Math.round(day.points),
        activities: day.activities
          .sort((a, b) => b.points - a.points)
          .slice(0, 5),
      };
    }
  }

  // Most common time
  const mostCommonTime = (
    Object.entries(timeBuckets) as Array<
      [
        "morning" | "afternoon" | "evening" | "night",
        number,
      ]
    >
  ).sort((a, b) => b[1] - a[1])[0][0];

  // Bonus milestones
  const bonusMilestones = Array.from(bonusCounts.entries())
    .map(([description, count]) => ({ description, count }))
    .sort((a, b) => b.count - a.count);

  // ── Category breakdown (pre-aggregated) ───────────────────────────────────
  const categoryPointsRows = await ctx.db
    .query("categoryPoints")
    .withIndex("challengeUserCategory", (q: any) =>
      q.eq("challengeId", challengeId).eq("userId", userId)
    )
    .collect();

  const categories = await Promise.all(
    categoryPointsRows.map((cp: any) => ctx.db.get(cp.categoryId))
  );
  const totalCategoryPoints = categoryPointsRows.reduce(
    (sum: number, cp: any) => sum + cp.totalPoints,
    0
  );
  const categoryBreakdown = categoryPointsRows
    .map((cp: any, i: number) => ({
      name: categories[i]?.name ?? "Unknown",
      points: Math.round(cp.totalPoints),
      percentage:
        totalCategoryPoints > 0
          ? Math.round((cp.totalPoints / totalCategoryPoints) * 100)
          : 0,
    }))
    .filter((c: any) => c.points > 0)
    .sort((a: any, b: any) => b.points - a.points);

  // ── Weekly progression (pre-aggregated) ───────────────────────────────────
  const weeklyRows = await ctx.db
    .query("weeklyCategoryPoints")
    .withIndex("challengeUserCategoryWeek", (q: any) =>
      q.eq("challengeId", challengeId).eq("userId", userId)
    )
    .collect();

  const weekMap = new Map<number, number>();
  for (const row of weeklyRows) {
    weekMap.set(
      row.weekNumber,
      (weekMap.get(row.weekNumber) ?? 0) + row.totalPoints
    );
  }
  const weeklyPoints = Array.from(weekMap.entries())
    .map(([week, points]) => ({ week, points: Math.round(points) }))
    .sort((a, b) => a.week - b.week);

  // ── Social stats (parallel) ───────────────────────────────────────────────

  // Build set of this user's activity IDs in this challenge for scoping
  const activityIds = userActivities.map((a: any) => a._id as string);

  const [
    likesGivenAll,
    commentsGivenAll,
    pokesSentAll,
    pokesReceivedAll,
    forumPostsAll,
    affinitiesFromMe,
    miniGameParticipants,
    userAchievements,
    userBadges,
    // Per-activity likes received (batched)
    ...likesPerActivity
  ] = await Promise.all([
    // Likes given (all challenges — filtered below)
    ctx.db
      .query("likes")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .collect(),
    // Comments given (all challenges — filtered below)
    ctx.db
      .query("comments")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .collect(),
    // Pokes sent
    ctx.db
      .query("pokes")
      .withIndex("pokerPokedChallenge", (q: any) => q.eq("pokerId", userId))
      .collect(),
    // Pokes received
    ctx.db
      .query("pokes")
      .withIndex("pokedId", (q: any) => q.eq("pokedId", userId))
      .collect(),
    // Forum posts
    ctx.db
      .query("forumPosts")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .collect(),
    // Affinities: who I engage with most
    ctx.db
      .query("userAffinities")
      .withIndex("challengeViewer", (q: any) =>
        q.eq("challengeId", challengeId).eq("viewerUserId", userId)
      )
      .collect(),
    // Mini-game participations
    ctx.db
      .query("miniGameParticipants")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .collect(),
    // Achievements
    ctx.db
      .query("userAchievements")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("challengeId"), challengeId))
      .collect(),
    // Badges
    ctx.db
      .query("userBadges")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("challengeId"), challengeId))
      .collect(),
    // Batch: likes on each of user's activities (indexed, efficient)
    ...activityIds.map((aid: string) =>
      ctx.db
        .query("likes")
        .withIndex("activityId", (q: any) => q.eq("activityId", aid))
        .collect()
    ),
  ]);

  // Build per-activity like counts (for likes received + most popular)
  const likesPerActivityMap = new Map<string, any[]>();
  let likesReceived = 0;
  for (let i = 0; i < activityIds.length; i++) {
    const likes = likesPerActivity[i] as any[];
    likesPerActivityMap.set(activityIds[i], likes);
    likesReceived += likes.length;
  }

  // Likes given: scope to this challenge by looking up each liked activity
  // (user typically has ~50-200 likes; individual doc reads are cheaper than scanning 22k activities)
  const likedActivityDocs = await Promise.all(
    likesGivenAll.map((l: any) => ctx.db.get(l.activityId))
  );
  const likesGiven = likedActivityDocs.filter(
    (doc: any) => doc && doc.challengeId === challengeId
  ).length;

  // Comments given: scope to this challenge
  const commentedActivityIds = Array.from(new Set(
    commentsGivenAll
      .filter((c: any) => c.parentType === "activity" && c.activityId)
      .map((c: any) => c.activityId as string)
  ));
  const commentedActivityDocs = await Promise.all(
    commentedActivityIds.map((id) => ctx.db.get(id as Id<"activities">))
  );
  const challengeCommentedIds = new Set(
    commentedActivityDocs
      .filter((doc: any) => doc && doc.challengeId === challengeId)
      .map((doc: any) => doc._id as string)
  );
  const commentsGiven = commentsGivenAll.filter(
    (c: any) =>
      c.parentType === "activity" &&
      challengeCommentedIds.has(c.activityId as string)
  ).length;

  // Comments received: batch query per activity
  const commentsPerActivity = await Promise.all(
    activityIds.map((aid: string) =>
      ctx.db
        .query("comments")
        .withIndex("activityIdByType", (q: any) =>
          q.eq("activityId", aid).eq("parentType", "activity")
        )
        .collect()
    )
  );
  let commentsReceived = 0;
  for (const comments of commentsPerActivity) {
    commentsReceived += (comments as any[]).filter(
      (c: any) => c.userId !== userId
    ).length;
  }

  // Filter social data to this challenge
  const pokesSent = pokesSentAll.filter(
    (p: any) => p.challengeId === challengeId
  ).length;
  const pokesReceived = pokesReceivedAll.filter(
    (p: any) => p.challengeId === challengeId
  ).length;
  const forumPosts = forumPostsAll.filter(
    (p: any) =>
      p.challengeId === challengeId && !p.parentPostId && !p.deletedAt
  ).length;
  const forumReplies = forumPostsAll.filter(
    (p: any) =>
      p.challengeId === challengeId && p.parentPostId && !p.deletedAt
  ).length;

  // Biggest fan: find who engages most with me via affinities
  // Query all challenge affinities where I'm the author (who views me most)
  const affinitiesForMe = (
    await ctx.db
      .query("userAffinities")
      .withIndex("challengeViewer", (q: any) =>
        q.eq("challengeId", challengeId)
      )
      .collect()
  )
    .filter((a: any) => a.authorUserId === userId && a.viewerUserId !== userId)
    .sort((a: any, b: any) => b.score - a.score);

  let biggestFan: WrappedData["biggestFan"] = null;
  if (affinitiesForMe.length > 0) {
    const fanUser = await ctx.db.get(affinitiesForMe[0].viewerUserId);
    if (fanUser) {
      biggestFan = {
        name: fanUser.name ?? fanUser.username ?? "Unknown",
        avatarUrl: fanUser.avatarUrl ?? null,
        score: affinitiesForMe[0].score,
      };
    }
  }

  // Your favorite (who I engage with most)
  const myAffinities = affinitiesFromMe
    .filter((a: any) => a.authorUserId !== userId)
    .sort((a: any, b: any) => b.score - a.score);

  let yourFavorite: WrappedData["yourFavorite"] = null;
  if (myAffinities.length > 0) {
    const favUser = await ctx.db.get(myAffinities[0].authorUserId);
    if (favUser) {
      yourFavorite = {
        name: favUser.name ?? favUser.username ?? "Unknown",
        avatarUrl: favUser.avatarUrl ?? null,
        score: myAffinities[0].score,
      };
    }
  }

  // Most popular activity (most likes, using pre-fetched per-activity likes)
  let mostPopularActivity: WrappedData["mostPopularActivity"] = null;
  if (userActivities.length > 0) {
    let maxLikes = 0;
    let popularId: string | null = null;
    for (const [aid, likes] of likesPerActivityMap) {
      if (likes.length > maxLikes) {
        maxLikes = likes.length;
        popularId = aid;
      }
    }
    if (popularId && maxLikes > 0) {
      const activity = userActivities.find(
        (a: any) => (a._id as string) === popularId
      );
      if (activity) {
        const at = typeMap.get(activity.activityTypeId);
        mostPopularActivity = {
          points: Math.round(activity.pointsEarned ?? 0),
          likes: maxLikes,
          activityTypeName: at?.name ?? "Unknown",
          date: formatDateOnlyFromUtcMs(activity.loggedDate),
        };
      }
    }
  }

  // ── Mini-game results ─────────────────────────────────────────────────────
  const challengeMiniGames = await ctx.db
    .query("miniGames")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  const miniGameMap = new Map<string, any>(
    challengeMiniGames.map((g: any) => [g._id as string, g])
  );

  const miniGameResults: WrappedData["miniGameResults"] = [];
  for (const mp of miniGameParticipants) {
    const game = miniGameMap.get(mp.miniGameId as string) as any;
    if (!game || game.status !== "completed") continue;

    let outcome = "";
    let partnerName: string | undefined;

    if (game.type === "partner_week" && mp.partnerUserId) {
      const partner = await ctx.db.get(mp.partnerUserId);
      partnerName = partner?.name ?? partner?.username ?? "Unknown";
      outcome = `Partnered with ${partnerName}`;
    } else if (game.type === "hunt_week") {
      const caught = mp.outcome?.caughtPrey;
      const wasCaught = mp.outcome?.wasCaught;
      if (caught && !wasCaught) outcome = "Caught your prey and escaped!";
      else if (caught && wasCaught)
        outcome = "Caught your prey but got caught too";
      else if (!caught && !wasCaught) outcome = "Survived the hunt";
      else outcome = "Got caught!";
    } else if (game.type === "pr_week") {
      outcome = mp.outcome?.hitPr
        ? `Beat your PR! (${Math.round(mp.outcome.weekMaxPoints ?? 0)} pts)`
        : "Didn't beat your PR this time";
    }

    miniGameResults.push({
      type: game.type,
      partnerName,
      outcome,
      bonusPoints: mp.bonusPoints ?? 0,
    });
  }

  // ── Achievements + Badges ─────────────────────────────────────────────────
  const [achievementDocs, badgeDocs] = await Promise.all([
    Promise.all(
      userAchievements.map((ua: any) => ctx.db.get(ua.achievementId))
    ),
    Promise.all(userBadges.map((ub: any) => ctx.db.get(ub.badgeId))),
  ]);

  const achievementsEarned = achievementDocs
    .filter(Boolean)
    .map((a: any) => ({ name: a.name, description: a.description }));

  const badgesEarned = badgeDocs
    .filter(Boolean)
    .map((b: any) => ({
      name: b.name,
      icon: b.icon ?? null,
      imagePublicId: b.imagePublicId ?? null,
    }));

  return {
    userName: user.name ?? user.username ?? "Unknown",
    avatarUrl: user.avatarUrl ?? null,
    challengeName: challenge.name,

    totalPoints: Math.round(participation.totalPoints),
    rank,
    totalParticipants,

    totalActivities: userActivities.filter(
      (a: any) => !typeMap.get(a.activityTypeId)?.isNegative
    ).length,
    avgActivitiesPerParticipant: 0,

    currentStreak: participation.currentStreak,

    favoriteActivity,
    activityVariety: typeCountMap.size,

    totalDistanceMiles: Math.round(totalDistanceMiles * 10) / 10,
    totalMinutes: Math.round(totalMinutes),
    totalElevationMeters: Math.round(totalElevationMeters),

    prDay,
    weeklyPoints,
    activityTimeDistribution: timeBuckets,
    mostCommonTime,
    categoryBreakdown,
    bonusMilestones,

    likesGiven,
    likesReceived,
    biggestFan,
    yourFavorite,
    mostPopularActivity,

    commentsGiven,
    commentsReceived,
    pokesSent,
    pokesReceived,
    forumPosts,
    forumReplies,

    miniGameResults,
    achievementsEarned,
    badgesEarned,

    photosShared,
    drinkPenalties,
    drinkPenaltyPoints: Math.round(drinkPenaltyPoints),
  };
}

// ─── Public query (for participants) ─────────────────────────────────────────

export const getWrappedData = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge?.wrappedEnabled) return null;

    return computeWrappedData(ctx, user._id, args.challengeId);
  },
});

// ─── Admin preview query ─────────────────────────────────────────────────────

export const getWrappedPreview = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return null;

    // Verify admin access: global admin, challenge creator, or challenge admin
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    let isAdmin = currentUser.role === "admin";
    if (!isAdmin && challenge.creatorId === currentUser._id) {
      isAdmin = true;
    }
    if (!isAdmin) {
      const participation = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q: any) =>
          q.eq("userId", currentUser._id).eq("challengeId", args.challengeId)
        )
        .first();
      if (participation?.role === "admin") {
        isAdmin = true;
      }
    }
    if (!isAdmin) return null;

    return computeWrappedData(ctx, args.userId, args.challengeId);
  },
});
