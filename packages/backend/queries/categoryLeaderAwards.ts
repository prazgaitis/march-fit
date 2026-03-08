import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getChallengeWeekNumber, getTotalWeeks } from "../lib/weeks";

/**
 * Preview category leader awards for a given week.
 * Returns the #1 leader per category and their bonus points.
 * Also indicates whether awards have already been applied for this week.
 */
export const previewWeeklyAwards = query({
  args: {
    challengeId: v.id("challenges"),
    weekNumber: v.number(),
    bonusPoints: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    const totalWeeks = getTotalWeeks(challenge.durationDays);
    const currentWeek = getChallengeWeekNumber(challenge.startDate, Date.now());
    const weekNumber = Math.max(1, Math.min(args.weekNumber, totalWeeks));

    // Check if awards were already applied for this week.
    // Use sourceExternalId index (source, externalId) to scan only category_leader activities.
    const existingAward = await ctx.db
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
    for (const a of existingAward) {
      // Parse week number from externalId: "category_leader_week_3_categoryId_userId"
      const match = a.externalId?.match(/^category_leader_week_(\d+)_/);
      if (match) appliedWeeks.add(Number(match[1]));
    }
    const alreadyApplied = appliedWeeks.has(weekNumber);

    // Get categories that show in leaderboard
    const activityTypes = await ctx.db
      .query("activityTypes")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const uniqueCategoryIds = [
      ...new Set(
        activityTypes
          .map((at) => at.categoryId as string | undefined)
          .filter((id): id is string => !!id)
      ),
    ];

    if (uniqueCategoryIds.length === 0) {
      return {
        weekNumber,
        totalWeeks,
        currentWeek,
        alreadyApplied,
        appliedWeeks: [...appliedWeeks],
        awards: [],
      };
    }

    const categoryDocs = await Promise.all(
      uniqueCategoryIds.map((id) => ctx.db.get(id as Id<"categories">))
    );
    const leaderboardCategories = categoryDocs.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.showInCategoryLeaderboard === true
    );

    if (leaderboardCategories.length === 0) {
      return {
        weekNumber,
        totalWeeks,
        currentWeek,
        alreadyApplied,
        appliedWeeks: [...appliedWeeks],
        awards: [],
      };
    }

    // For each category, find the #1 leader for the week
    const awards = await Promise.all(
      leaderboardCategories.map(async (cat) => {
        const points = await ctx.db
          .query("weeklyCategoryPoints")
          .withIndex("weekCategory", (q) =>
            q
              .eq("challengeId", args.challengeId)
              .eq("weekNumber", weekNumber)
              .eq("categoryId", cat._id)
          )
          .collect();

        const sorted = points
          .filter((p) => p.totalPoints > 0)
          .sort((a, b) => b.totalPoints - a.totalPoints);

        if (sorted.length === 0) return null;

        const leader = sorted[0];
        const user = await ctx.db.get(leader.userId);
        if (!user) return null;

        // Check for ties
        const tiedUsers = sorted.filter(
          (p) => p.totalPoints === leader.totalPoints
        );

        return {
          category: { id: cat._id, name: cat.name },
          leader: {
            userId: user._id,
            name: user.name ?? null,
            username: user.username,
            avatarUrl: user.avatarUrl ?? null,
          },
          weeklyPoints: leader.totalPoints,
          bonusPoints: args.bonusPoints,
          hasTie: tiedUsers.length > 1,
          tiedCount: tiedUsers.length,
        };
      })
    );

    return {
      weekNumber,
      totalWeeks,
      currentWeek,
      alreadyApplied,
      appliedWeeks: [...appliedWeeks],
      awards: awards
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => a.category.name.localeCompare(b.category.name)),
    };
  },
});
