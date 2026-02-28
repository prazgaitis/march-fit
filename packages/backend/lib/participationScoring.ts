import type { Id } from "../_generated/dataModel";
import { notDeleted } from "./activityFilters";
import { applyCategoryPointsDelta } from "./categoryPoints";
import { applyWeeklyCategoryPointsDeltaFromDate } from "./weeklyCategoryPoints";
import { aggregateDailyStreakPoints, computeStreak } from "./streak";

export async function recomputeStreakForUserChallenge(
  ctx: any,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  streakMinPoints: number
) {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId)
    )
    .filter(notDeleted)
    .collect();

  if (activities.length === 0) {
    return { currentStreak: 0, lastStreakDayTs: undefined, totalStreakBonus: 0 };
  }

  const activityTypeIds = Array.from(
    new Set(activities.map((a: any) => a.activityTypeId))
  ) as Id<"activityTypes">[];
  const activityTypes = await Promise.all(
    activityTypeIds.map((id) => ctx.db.get(id))
  );
  const contributesMap = new Map<Id<"activityTypes">, boolean>();
  for (let i = 0; i < activityTypeIds.length; i++) {
    const at = activityTypes[i];
    if (at) contributesMap.set(activityTypeIds[i], at.contributesToStreak);
  }

  const dailyPoints = aggregateDailyStreakPoints(
    activities,
    (id) => contributesMap.get(id as Id<"activityTypes">) ?? false,
  );

  const result = computeStreak(dailyPoints, streakMinPoints);
  return {
    currentStreak: result.currentStreak,
    lastStreakDayTs: result.lastStreakDay,
    totalStreakBonus: result.totalStreakBonus,
  };
}

export async function applyParticipationScoreDeltaAndRecomputeStreak(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    pointsDelta: number;
    streakMinPoints: number;
    now?: number;
    /** When provided, also increments the categoryPoints aggregation table. */
    categoryId?: Id<"categories">;
    /** Pass alongside categoryId for weekly category aggregation. */
    loggedDate?: number;
    /** Pass alongside categoryId for weekly category aggregation. */
    challengeStartDate?: string | number;
  }
) {
  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", args.userId).eq("challengeId", args.challengeId)
    )
    .first();

  if (!participation) {
    return null;
  }

  const recomputed = await recomputeStreakForUserChallenge(
    ctx,
    args.userId,
    args.challengeId,
    args.streakMinPoints
  );
  const now = args.now ?? Date.now();

  const previousStreakBonus = participation.streakBonusPoints ?? 0;
  const streakBonusDelta = recomputed.totalStreakBonus - previousStreakBonus;

  await ctx.db.patch(participation._id, {
    totalPoints: participation.totalPoints + args.pointsDelta + streakBonusDelta,
    streakBonusPoints: recomputed.totalStreakBonus,
    currentStreak: recomputed.currentStreak,
    lastStreakDay: recomputed.lastStreakDayTs,
    updatedAt: now,
  });

  // Maintain category points aggregation when a category is known.
  if (args.categoryId) {
    await applyCategoryPointsDelta(ctx, {
      userId: args.userId,
      challengeId: args.challengeId,
      categoryId: args.categoryId,
      pointsDelta: args.pointsDelta,
      now,
    });

    // Also maintain weekly category aggregation when loggedDate is available.
    if (
      args.loggedDate !== undefined &&
      args.challengeStartDate !== undefined
    ) {
      await applyWeeklyCategoryPointsDeltaFromDate(ctx, {
        userId: args.userId,
        challengeId: args.challengeId,
        categoryId: args.categoryId,
        loggedDate: args.loggedDate,
        challengeStartDate: args.challengeStartDate,
        pointsDelta: args.pointsDelta,
        now,
      });
    }
  }

  return {
    participationId: participation._id,
    previousStreak: participation.currentStreak,
    currentStreak: recomputed.currentStreak,
    lastStreakDayTs: recomputed.lastStreakDayTs,
  };
}
