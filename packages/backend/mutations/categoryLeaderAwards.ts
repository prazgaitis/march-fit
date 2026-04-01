import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getTotalWeeks } from "../lib/weeks";
import { insertActivity, deleteActivity } from "../lib/activityWrites";
import {
  PLACEMENT_COUNT,
  getWeeklyPlacementPoints,
  getCumulativePlacementPoints,
  placementLabel,
} from "../lib/categoryLeaderPoints";

type MutationDbCtx = Pick<MutationCtx, "db" | "runMutation">;

/**
 * Apply category leader bonus points for a given week or cumulative.
 *
 * weekNumber 1–N  → weekly awards (top 3 per category, overall)
 * weekNumber 0    → cumulative awards (top 3 per category, split by gender:
 *                    women's and men's/open divisions each get 1st/2nd/3rd)
 *
 * Idempotent — skips placements that already have awards.
 */
export const applyWeeklyAwards = mutation({
  args: {
    challengeId: v.id("challenges"),
    weekNumber: v.number(), // 0 = cumulative
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const totalWeeks = getTotalWeeks(challenge.durationDays);
    const isCumulative = args.weekNumber === 0;
    const weekNumber = isCumulative
      ? 0
      : Math.max(1, Math.min(args.weekNumber, totalWeeks));

    const placementPoints = isCumulative
      ? getCumulativePlacementPoints(totalWeeks)
      : getWeeklyPlacementPoints(weekNumber);

    // Check for existing awards (idempotency)
    const existingAwards = await ctx.db
      .query("activities")
      .withIndex("sourceExternalId", (q: any) =>
        q.eq("source", "category_leader")
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("challengeId"), args.challengeId),
          q.eq(q.field("deletedAt"), undefined),
        )
      )
      .collect();

    const appliedKeys = new Set(
      existingAwards.map((a: any) => a.externalId).filter(Boolean)
    );

    // Get leaderboard categories
    const leaderboardCategories = await getLeaderboardCategories(ctx, args.challengeId);

    // Find or create bonus activity type
    const bonusActivityType = await getOrCreateBonusActivityType(
      ctx,
      args.challengeId
    );

    const now = Date.now();
    let awarded = 0;
    let skipped = 0;

    for (const cat of leaderboardCategories) {
      const sorted = isCumulative
        ? await getCumulativeLeaders(ctx, args.challengeId, cat._id)
        : await getWeeklyLeaders(ctx, args.challengeId, cat._id, weekNumber);

      if (sorted.length === 0) {
        skipped++;
        continue;
      }

      // Cumulative awards are split by gender; weekly awards are overall
      const groups = isCumulative
        ? await splitByGender(ctx, sorted)
        : [{ tag: null, entries: sorted }];

      for (const { tag, entries } of groups) {
        const top = entries.slice(0, PLACEMENT_COUNT);
        if (top.length === 0) continue;

        for (let i = 0; i < top.length; i++) {
          const entry = top[i];
          const placement = i + 1;
          const bonus = placementPoints[i];

          // Gender-tagged external IDs for cumulative so they don't collide
          const externalId = isCumulative
            ? `category_leader_cumulative_${tag}_${cat._id}_${entry.userId}`
            : `category_leader_week_${weekNumber}_${cat._id}_${entry.userId}`;

          if (appliedKeys.has(externalId)) {
            skipped++;
            continue;
          }

          const divisionLabel = tag === "women" ? "Women's" : tag === "open" ? "Open" : "";
          const weekLabel = isCumulative ? "Cumulative" : `Week ${weekNumber}`;
          const label = divisionLabel ? `${weekLabel} ${divisionLabel}` : weekLabel;
          const description = `${label} ${cat.name} ${placementLabel(placement)} Place (${bonus} pts)`;

          await insertActivity(ctx, {
            userId: entry.userId,
            challengeId: args.challengeId,
            activityTypeId: bonusActivityType._id,
            loggedDate: now,
            pointsEarned: bonus,
            notes: description,
            flagged: false,
            adminCommentVisibility: "internal",
            resolutionStatus: "resolved",
            source: "category_leader",
            externalId,
            externalData: {
              weekNumber,
              isCumulative,
              categoryId: cat._id,
              categoryName: cat.name,
              placement,
              division: tag,
              categoryPoints: entry.totalPoints,
            },
            createdAt: now,
            updatedAt: now,
          });

          // Update user's total points
          const userChallenge = await ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q: any) =>
              q
                .eq("userId", entry.userId)
                .eq("challengeId", args.challengeId)
            )
            .first();

          if (userChallenge) {
            await ctx.db.patch(userChallenge._id, {
              totalPoints: userChallenge.totalPoints + bonus,
              updatedAt: now,
            });
          }

          awarded++;
        }
      }
    }

    return { awarded, skipped, weekNumber, isCumulative };
  },
});

/**
 * Revoke category leader awards for a given week or cumulative.
 * Deletes the bonus activities and reverses totalPoints on userChallenges.
 * Handles both old-style (no gender tag) and new gender-tagged cumulative external IDs.
 */
export const revokeWeeklyAwards = mutation({
  args: {
    challengeId: v.id("challenges"),
    weekNumber: v.number(), // 0 = cumulative
  },
  handler: async (ctx, args) => {
    const isCumulative = args.weekNumber === 0;

    // Find all category_leader activities for this challenge
    const allAwards = await ctx.db
      .query("activities")
      .withIndex("sourceExternalId", (q: any) =>
        q.eq("source", "category_leader")
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("challengeId"), args.challengeId),
          q.eq(q.field("deletedAt"), undefined),
        )
      )
      .collect();

    // Match both old-style and new gender-tagged cumulative IDs
    const prefixes = isCumulative
      ? [
          "category_leader_cumulative_women_",
          "category_leader_cumulative_open_",
          "category_leader_cumulative_",  // old-style (no gender tag)
        ]
      : [`category_leader_week_${args.weekNumber}_`];

    const toRevoke = allAwards.filter(
      (a: any) => a.externalId && prefixes.some((p) => a.externalId.startsWith(p))
    );

    let revoked = 0;

    for (const activity of toRevoke) {
      // Reverse totalPoints on userChallenges
      const userChallenge = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q: any) =>
          q
            .eq("userId", activity.userId)
            .eq("challengeId", args.challengeId)
        )
        .first();

      if (userChallenge) {
        await ctx.db.patch(userChallenge._id, {
          totalPoints: userChallenge.totalPoints - activity.pointsEarned,
          updatedAt: Date.now(),
        });
      }

      // Delete the activity (handles aggregate cleanup)
      await deleteActivity(ctx, activity._id);
      revoked++;
    }

    return { revoked, weekNumber: args.weekNumber, isCumulative };
  },
});

async function getLeaderboardCategories(
  ctx: MutationDbCtx,
  challengeId: Id<"challenges">,
) {
  const activityTypes = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q: any) =>
      q.eq("challengeId", challengeId)
    )
    .collect();

  const uniqueCategoryIds = [
    ...new Set(
      activityTypes
        .map((at: any) => at.categoryId as string | undefined)
        .filter((id: any): id is string => !!id)
    ),
  ];

  const categoryDocs = await Promise.all(
    uniqueCategoryIds.map((id) => ctx.db.get(id as Id<"categories">))
  );

  return categoryDocs.filter(
    (c): c is NonNullable<typeof c> =>
      c !== null && c.showInCategoryLeaderboard === true
  );
}

/**
 * Split sorted leader entries into women's and open (men's) divisions.
 * women = gender === "female"; open = male, null, or undefined.
 */
async function splitByGender(
  ctx: MutationDbCtx,
  sorted: any[],
): Promise<Array<{ tag: "women" | "open"; entries: any[] }>> {
  const women: any[] = [];
  const open: any[] = [];

  for (const entry of sorted) {
    const user = await ctx.db.get(entry.userId as Id<"users">);
    if (!user) continue;
    if (user.gender === "female") {
      women.push(entry);
    } else {
      open.push(entry);
    }
  }

  return [
    { tag: "women" as const, entries: women },
    { tag: "open" as const, entries: open },
  ];
}

async function getOrCreateBonusActivityType(
  ctx: MutationDbCtx,
  challengeId: Id<"challenges">
) {
  let bonusType = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q: any) => q.eq("challengeId", challengeId))
    .filter((q: any) => q.eq(q.field("name"), "Category Leader Bonus"))
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

/**
 * Sort by totalMetricValue (raw metric like miles) so bonus points don't
 * distort rankings. Falls back to totalPoints when metric data isn't
 * populated yet (pre-backfill).
 */
function sortByMetric(entries: any[]): any[] {
  const hasMetricData = entries.some((p: any) => (p.totalMetricValue ?? 0) > 0);
  if (hasMetricData) {
    return entries.sort(
      (a: any, b: any) =>
        (b.totalMetricValue ?? 0) - (a.totalMetricValue ?? 0)
    );
  }
  return entries.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
}

async function getWeeklyLeaders(
  ctx: MutationDbCtx,
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

  return sortByMetric(
    points.filter((p: any) => p.totalPoints > 0 || (p.totalMetricValue ?? 0) > 0)
  );
}

async function getCumulativeLeaders(
  ctx: MutationDbCtx,
  challengeId: Id<"challenges">,
  categoryId: Id<"categories">
) {
  const points = await ctx.db
    .query("categoryPoints")
    .withIndex("challengeCategory", (q: any) =>
      q.eq("challengeId", challengeId).eq("categoryId", categoryId)
    )
    .collect();

  return sortByMetric(
    points.filter((p: any) => p.totalPoints > 0 || (p.totalMetricValue ?? 0) > 0)
  );
}
