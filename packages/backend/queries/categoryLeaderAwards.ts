import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getChallengeWeekNumber, getTotalWeeks } from "../lib/weeks";
import {
  PLACEMENT_COUNT,
  getWeeklyPlacementPoints,
  getCumulativePlacementPoints,
} from "../lib/categoryLeaderPoints";

/**
 * Preview category leader awards for a given week or cumulative.
 *
 * weekNumber 1–N  → weekly awards (top 3 per category)
 * weekNumber 0    → cumulative awards (top 3 per category, all-time)
 */
export const previewWeeklyAwards = query({
  args: {
    challengeId: v.id("challenges"),
    weekNumber: v.number(), // 0 = cumulative
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    const totalWeeks = getTotalWeeks(challenge.durationDays);
    const currentWeek = getChallengeWeekNumber(challenge.startDate, Date.now());
    const isCumulative = args.weekNumber === 0;
    const weekNumber = isCumulative
      ? 0
      : Math.max(1, Math.min(args.weekNumber, totalWeeks));

    const placementPoints = isCumulative
      ? getCumulativePlacementPoints(totalWeeks)
      : getWeeklyPlacementPoints(weekNumber);

    // Find all existing category_leader awards for this challenge
    const existingAwards = await ctx.db
      .query("activities")
      .withIndex("sourceExternalId", (q) =>
        q.eq("source", "category_leader")
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("challengeId"), args.challengeId),
          q.eq(q.field("deletedAt"), undefined),
        )
      )
      .collect();

    const appliedWeeks = new Set<number>();
    for (const a of existingAwards) {
      if (!a.externalId) continue;
      if (a.externalId.startsWith("category_leader_cumulative_")) {
        appliedWeeks.add(0);
      } else {
        const match = a.externalId.match(/^category_leader_week_(\d+)_/);
        if (match) appliedWeeks.add(Number(match[1]));
      }
    }
    const alreadyApplied = appliedWeeks.has(weekNumber);

    // Get leaderboard categories
    const leaderboardCategories = await getLeaderboardCategories(
      ctx,
      args.challengeId
    );

    if (leaderboardCategories.length === 0) {
      return {
        weekNumber,
        totalWeeks,
        currentWeek,
        isCumulative,
        alreadyApplied,
        appliedWeeks: [...appliedWeeks],
        placementPoints,
        awards: [],
      };
    }

    // Build awards per category
    const userCache = new Map<string, any>();
    const getUser = async (userId: Id<"users">) => {
      const key = userId as string;
      if (!userCache.has(key)) {
        const user = await ctx.db.get(userId);
        userCache.set(
          key,
          user
            ? {
                userId: user._id,
                name: user.name ?? null,
                username: user.username,
                avatarUrl: user.avatarUrl ?? null,
              }
            : null
        );
      }
      return userCache.get(key);
    };

    const awards = await Promise.all(
      leaderboardCategories.map(async (cat) => {
        const sorted = isCumulative
          ? await getCumulativeLeaders(ctx, args.challengeId, cat._id)
          : await getWeeklyLeaders(
              ctx,
              args.challengeId,
              cat._id,
              weekNumber
            );

        if (sorted.length === 0) return null;

        const placements = await Promise.all(
          sorted.slice(0, PLACEMENT_COUNT).map(async (entry: any, index: number) => {
            const user = await getUser(entry.userId);
            if (!user) return null;
            return {
              placement: index + 1,
              user,
              totalPoints: entry.totalPoints,
              bonusPoints: placementPoints[index],
            };
          })
        );

        return {
          category: { id: cat._id, name: cat.name },
          placements: placements.filter(
            (p): p is NonNullable<typeof p> => p !== null
          ),
        };
      })
    );

    return {
      weekNumber,
      totalWeeks,
      currentWeek,
      isCumulative,
      alreadyApplied,
      appliedWeeks: [...appliedWeeks],
      placementPoints,
      awards: awards
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .filter((a) => a.placements.length > 0)
        .sort((a, b) => a.category.name.localeCompare(b.category.name)),
    };
  },
});

async function getLeaderboardCategories(
  ctx: { db: any },
  challengeId: Id<"challenges">
) {
  const activityTypes = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .collect();

  const uniqueCategoryIds = [
    ...new Set(
      activityTypes
        .map((at: any) => at.categoryId as string | undefined)
        .filter((id: any): id is string => !!id)
    ),
  ] as string[];

  if (uniqueCategoryIds.length === 0) return [];

  const categoryDocs = await Promise.all(
    uniqueCategoryIds.map((id) => ctx.db.get(id as Id<"categories">))
  );

  return categoryDocs.filter(
    (c: any): c is NonNullable<typeof c> =>
      c !== null && c.showInCategoryLeaderboard === true
  );
}

async function getWeeklyLeaders(
  ctx: { db: any },
  challengeId: Id<"challenges">,
  categoryId: Id<"categories">,
  weekNumber: number
) {
  const points = await ctx.db
    .query("weeklyCategoryPoints")
    .withIndex("weekCategory", (q: any) =>
      q
        .eq("challengeId", challengeId)
        .eq("weekNumber", weekNumber)
        .eq("categoryId", categoryId)
    )
    .collect();

  return points
    .filter((p: any) => p.totalPoints > 0)
    .sort((a: any, b: any) => b.totalPoints - a.totalPoints);
}

async function getCumulativeLeaders(
  ctx: { db: any },
  challengeId: Id<"challenges">,
  categoryId: Id<"categories">
) {
  const points = await ctx.db
    .query("categoryPoints")
    .withIndex("challengeCategory", (q: any) =>
      q.eq("challengeId", challengeId).eq("categoryId", categoryId)
    )
    .collect();

  return points
    .filter((p: any) => p.totalPoints > 0)
    .sort((a: any, b: any) => b.totalPoints - a.totalPoints);
}
