import type { Id } from "../_generated/dataModel";
import { notDeleted } from "./activityFilters";

const DAY_MS = 24 * 60 * 60 * 1000;

const getDateOnlyTs = (ts: number) => {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

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
    return { currentStreak: 0, lastStreakDayTs: undefined };
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

  const dailyPoints = new Map<number, number>();
  for (const act of activities) {
    const contributes =
      contributesMap.get(act.activityTypeId as Id<"activityTypes">) ?? false;
    if (!contributes) continue;
    const dayTs = getDateOnlyTs(act.loggedDate);
    dailyPoints.set(dayTs, (dailyPoints.get(dayTs) ?? 0) + act.pointsEarned);
  }

  const thresholdDays = Array.from(dailyPoints.entries())
    .filter(([, points]) => points >= streakMinPoints)
    .map(([dayTs]) => dayTs)
    .sort((a, b) => a - b);

  if (thresholdDays.length === 0) {
    return { currentStreak: 0, lastStreakDayTs: undefined };
  }

  let currentStreak = 1;
  let lastStreakDayTs = thresholdDays[0];
  for (let i = 1; i < thresholdDays.length; i++) {
    const dayTs = thresholdDays[i];
    const diffDays = Math.floor((dayTs - lastStreakDayTs) / DAY_MS);
    if (diffDays === 1) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    lastStreakDayTs = dayTs;
  }

  return { currentStreak, lastStreakDayTs };
}

export async function applyParticipationScoreDeltaAndRecomputeStreak(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    pointsDelta: number;
    streakMinPoints: number;
    now?: number;
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

  await ctx.db.patch(participation._id, {
    totalPoints: participation.totalPoints + args.pointsDelta,
    currentStreak: recomputed.currentStreak,
    lastStreakDay: recomputed.lastStreakDayTs,
    updatedAt: now,
  });

  return {
    participationId: participation._id,
    previousStreak: participation.currentStreak,
    currentStreak: recomputed.currentStreak,
    lastStreakDayTs: recomputed.lastStreakDayTs,
  };
}
