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

  // Category Breakdown
  categoryBreakdown: Array<{
    name: string;
    points: number;
    percentage: number;
  }>;

  // Bonus Milestones
  bonusMilestones: Array<{ description: string; count: number }>;

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

  // Community Totals (aggregated across all participants from pre-aggregated tables)
  communityTotals: {
    totalPoints: number;
    totalParticipants: number;
    totalCategoryEntries: number;
  };

  // Category Leaders (top scorer per category)
  categoryLeaders: Array<{
    categoryName: string;
    userName: string;
    avatarUrl: string | null;
    totalPoints: number;
  }>;

  // Top 10 Leaderboard
  top10: Array<{
    rank: number;
    userName: string;
    avatarUrl: string | null;
    totalPoints: number;
    isCurrentUser: boolean;
  }>;

  // Challenge winners
  winners: Array<{
    userId: string;
    placement: number;
    label?: string;
    userName: string;
    avatarUrl: string | null;
    totalPoints: number;
  }>;

  // Activity photos (cloudinary public IDs for wrapped backgrounds)
  activityPhotoIds: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Fisher-Yates shuffle a copy of the array, return at most `n` items. */
function shuffleAndTake<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
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
  const activityPhotoIds: string[] = [];

  const typeCountMap = new Map<string, { count: number; points: number }>();
  const dailyPoints = new Map<
    string,
    { points: number; activities: Array<{ name: string; points: number }> }
  >();
  const bonusCounts = new Map<string, number>();

  for (const activity of userActivities) {
    const metrics = (activity.metrics ?? {}) as Record<string, unknown>;
    const at = typeMap.get(activity.activityTypeId);

    totalDistanceMiles += getDistanceMiles(metrics);
    totalMinutes += getMinutes(metrics);
    totalElevationMeters += getElevationMeters(metrics);

    // Photos for background
    if (activity.cloudinaryPublicIds?.length > 0) {
      for (const pid of activity.cloudinaryPublicIds) {
        if (!pid.startsWith("v/")) {
          activityPhotoIds.push(pid);
        }
      }
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

  // ── Social stats + game data (parallel) ────────────────────────────────────

  const [
    affinitiesFromMe,
    miniGameParticipants,
    userAchievements,
    userBadges,
  ] = await Promise.all([
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
  ]);

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

  // ── Community totals + Category leaders ─────────────────────────────────
  // All from pre-aggregated categoryPoints table (avoids scanning activity docs
  // which contain large externalData payloads that blow Convex read-bytes limits).
  const allCategoryPoints = await ctx.db
    .query("categoryPoints")
    .withIndex("challengeCategory", (q: any) =>
      q.eq("challengeId", challengeId)
    )
    .collect();

  // Derived from pre-aggregated data (userChallenges, categoryPoints) to avoid
  // scanning all activity documents (which contain large externalData payloads
  // that blow Convex read-bytes limits).
  const communityTotalPoints = allParticipations.reduce(
    (sum: number, p: any) => sum + (p.totalPoints ?? 0),
    0
  );

  // Count total category-point entries per user to approximate activity breadth
  const communityTotalCategoryEntries = allCategoryPoints.length;

  const communityTotals = {
    totalPoints: Math.round(communityTotalPoints),
    totalParticipants,
    totalCategoryEntries: communityTotalCategoryEntries,
  };

  // ── Category leaders (top scorer per category) ───────────────────────────
  // Group categoryPoints by categoryId, find the top scorer in each
  const categoryTopMap = new Map<
    string,
    { userId: string; totalPoints: number }
  >();
  for (const cp of allCategoryPoints) {
    const catId = cp.categoryId as string;
    const current = categoryTopMap.get(catId);
    if (!current || cp.totalPoints > current.totalPoints) {
      categoryTopMap.set(catId, {
        userId: cp.userId as string,
        totalPoints: cp.totalPoints,
      });
    }
  }

  // Resolve category names and user info
  const categoryLeaderEntries = Array.from(categoryTopMap.entries());
  const [catDocs, leaderUsers] = await Promise.all([
    Promise.all(
      categoryLeaderEntries.map(([catId]) =>
        ctx.db.get(catId as Id<"categories">)
      )
    ),
    Promise.all(
      categoryLeaderEntries.map(([, entry]) =>
        ctx.db.get(entry.userId as Id<"users">)
      )
    ),
  ]);

  const categoryLeaders: WrappedData["categoryLeaders"] = categoryLeaderEntries
    .map(([, entry], i) => ({
      categoryName: catDocs[i]?.name ?? "Unknown",
      userName: leaderUsers[i]?.name ?? leaderUsers[i]?.username ?? "Unknown",
      avatarUrl: leaderUsers[i]?.avatarUrl ?? null,
      totalPoints: Math.round(entry.totalPoints),
    }))
    .filter((c) => c.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // ── Top 10 leaderboard ───────────────────────────────────────────────────
  const top10Participations = sorted.slice(0, 10);
  const top10Users = await Promise.all(
    top10Participations.map((p: any) => ctx.db.get(p.userId))
  );
  const top10: WrappedData["top10"] = top10Participations.map(
    (p: any, i: number) => ({
      rank: i + 1,
      userName: top10Users[i]?.name ?? top10Users[i]?.username ?? "Unknown",
      avatarUrl: top10Users[i]?.avatarUrl ?? null,
      totalPoints: Math.round(p.totalPoints),
      isCurrentUser: p.userId === userId,
    })
  );

  // ── Winners ──────────────────────────────────────────────────────────────
  const winnersRaw = (challenge.winners as any[]) ?? [];
  const winners: WrappedData["winners"] = await Promise.all(
    winnersRaw.map(async (w: any) => {
      const winnerUser = await ctx.db.get(w.userId);
      const winnerParticipation = sorted.find((p: any) => p.userId === w.userId);
      return {
        userId: w.userId,
        placement: w.placement,
        label: w.label,
        userName: winnerUser?.name ?? winnerUser?.username ?? "Unknown",
        avatarUrl: winnerUser?.avatarUrl ?? null,
        totalPoints: Math.round(winnerParticipation?.totalPoints ?? 0),
      };
    })
  );

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
    categoryBreakdown,
    bonusMilestones,

    biggestFan,
    yourFavorite,

    miniGameResults,
    achievementsEarned,
    badgesEarned,

    communityTotals,
    categoryLeaders,
    top10,
    winners,

    // Up to 12 random photos for wrapped backgrounds
    activityPhotoIds: shuffleAndTake(activityPhotoIds, 12),
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
