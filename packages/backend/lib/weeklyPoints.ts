import type { Id } from "../_generated/dataModel";

/**
 * Apply a points delta to the pre-aggregated weeklyPoints table.
 *
 * Mirrors applyCategoryPointsDelta in lib/categoryPoints.ts but is scoped
 * to a specific challenge week so the weekly leaderboard can read tiny
 * denormalized rows instead of scanning full activity documents.
 *
 * No-op when:
 *  - categoryId is undefined (uncategorized activity type)
 *  - pointsDelta is 0
 *  - weekNumber <= 0 (activity logged before challenge start)
 */
export async function applyWeeklyPointsDelta(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    categoryId: Id<"categories"> | undefined;
    weekNumber: number;
    pointsDelta: number;
    now?: number;
  }
) {
  if (!args.categoryId || args.pointsDelta === 0 || args.weekNumber <= 0) return;

  const existing = await ctx.db
    .query("weeklyPoints")
    .withIndex("challengeUserWeekCategory", (q: any) =>
      q
        .eq("challengeId", args.challengeId)
        .eq("userId", args.userId)
        .eq("weekNumber", args.weekNumber)
        .eq("categoryId", args.categoryId)
    )
    .first();

  const ts = args.now ?? Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalPoints: Math.max(0, existing.totalPoints + args.pointsDelta),
      updatedAt: ts,
    });
  } else if (args.pointsDelta > 0) {
    await ctx.db.insert("weeklyPoints", {
      challengeId: args.challengeId,
      userId: args.userId,
      weekNumber: args.weekNumber,
      categoryId: args.categoryId,
      totalPoints: args.pointsDelta,
      updatedAt: ts,
    });
  }
}
