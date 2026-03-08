import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getChallengeWeekNumber, getTotalWeeks } from "../lib/weeks";
import { insertActivity } from "../lib/activityWrites";
import type { MutationCtx } from "../_generated/server";

type MutationDbCtx = Pick<MutationCtx, "db" | "runMutation">;

/**
 * Apply category leader bonus points for a given week.
 * Awards bonus points to the #1 leader in each category.
 * Idempotent — skips categories that already have awards for the week.
 */
export const applyWeeklyAwards = mutation({
  args: {
    challengeId: v.id("challenges"),
    weekNumber: v.number(),
    bonusPoints: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const totalWeeks = getTotalWeeks(challenge.durationDays);
    const weekNumber = Math.max(1, Math.min(args.weekNumber, totalWeeks));

    // Check for existing awards this week (idempotency)
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

    const appliedKeys = new Set(
      existingAwards.map((a) => a.externalId).filter(Boolean)
    );

    // Get leaderboard categories
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

    const categoryDocs = await Promise.all(
      uniqueCategoryIds.map((id) => ctx.db.get(id as Id<"categories">))
    );
    const leaderboardCategories = categoryDocs.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.showInCategoryLeaderboard === true
    );

    // Find or create bonus activity type
    const bonusActivityType = await getOrCreateBonusActivityType(
      ctx,
      args.challengeId
    );

    const now = Date.now();
    let awarded = 0;
    let skipped = 0;

    for (const cat of leaderboardCategories) {
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

      if (sorted.length === 0) {
        skipped++;
        continue;
      }

      const leader = sorted[0];
      const externalId = `category_leader_week_${weekNumber}_${cat._id}_${leader.userId}`;

      if (appliedKeys.has(externalId)) {
        skipped++;
        continue;
      }

      // Award the bonus activity
      await insertActivity(ctx, {
        userId: leader.userId,
        challengeId: args.challengeId,
        activityTypeId: bonusActivityType._id,
        loggedDate: now,
        pointsEarned: args.bonusPoints,
        notes: `Week ${weekNumber} ${cat.name} Leader Bonus`,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "resolved",
        source: "category_leader",
        externalId,
        externalData: {
          weekNumber,
          categoryId: cat._id,
          categoryName: cat.name,
          weeklyPoints: leader.totalPoints,
        },
        createdAt: now,
        updatedAt: now,
      });

      // Update user's total points
      const userChallenge = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q
            .eq("userId", leader.userId)
            .eq("challengeId", args.challengeId)
        )
        .first();

      if (userChallenge) {
        await ctx.db.patch(userChallenge._id, {
          totalPoints: userChallenge.totalPoints + args.bonusPoints,
          updatedAt: now,
        });
      }

      awarded++;
    }

    return { awarded, skipped, weekNumber };
  },
});

async function getOrCreateBonusActivityType(
  ctx: MutationDbCtx,
  challengeId: Id<"challenges">
) {
  let bonusType = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
    .filter((q) => q.eq(q.field("name"), "Category Leader Bonus"))
    .first();

  if (!bonusType) {
    const now = Date.now();
    const id = await ctx.db.insert("activityTypes", {
      challengeId,
      name: "Category Leader Bonus",
      description: "Bonus points awarded to weekly category leaders",
      scoringConfig: { type: "fixed", basePoints: 0 },
      contributesToStreak: false,
      isNegative: false,
      createdAt: now,
      updatedAt: now,
    });
    bonusType = await ctx.db.get(id);
  }

  if (!bonusType) {
    throw new Error("Failed to create Category Leader Bonus activity type");
  }

  return bonusType;
}
