import type { Id } from "../_generated/dataModel";
import { getChallengeWeekNumber } from "./weeks";

/**
 * Apply a points delta to the pre-aggregated weeklyCategoryPoints table.
 *
 * Mirrors applyCategoryPointsDelta but scoped to a specific challenge week.
 * No-op when categoryId is undefined or pointsDelta is 0.
 */
export async function applyWeeklyCategoryPointsDelta(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    categoryId: Id<"categories"> | undefined;
    weekNumber: number;
    pointsDelta: number;
    metricDelta?: number;
    now?: number;
  }
) {
  if (
    !args.categoryId ||
    (args.pointsDelta === 0 && (args.metricDelta ?? 0) === 0) ||
    args.weekNumber <= 0
  )
    return;

  const existing = await ctx.db
    .query("weeklyCategoryPoints")
    .withIndex("challengeUserCategoryWeek", (q: any) =>
      q
        .eq("challengeId", args.challengeId)
        .eq("userId", args.userId)
        .eq("categoryId", args.categoryId)
        .eq("weekNumber", args.weekNumber)
    )
    .first();

  const ts = args.now ?? Date.now();
  const metricDelta = args.metricDelta ?? 0;

  if (existing) {
    const patch: Record<string, unknown> = {
      updatedAt: ts,
    };
    if (args.pointsDelta !== 0) {
      patch.totalPoints = Math.max(0, existing.totalPoints + args.pointsDelta);
    }
    if (metricDelta !== 0) {
      patch.totalMetricValue = Math.max(
        0,
        (existing.totalMetricValue ?? 0) + metricDelta
      );
    }
    await ctx.db.patch(existing._id, patch);
  } else if (args.pointsDelta > 0 || metricDelta > 0) {
    await ctx.db.insert("weeklyCategoryPoints", {
      challengeId: args.challengeId,
      userId: args.userId,
      categoryId: args.categoryId,
      weekNumber: args.weekNumber,
      totalPoints: Math.max(0, args.pointsDelta),
      totalMetricValue: Math.max(0, metricDelta),
      updatedAt: ts,
    });
  }
}

/**
 * Convenience wrapper: compute weekNumber from loggedDate + challengeStartDate,
 * then apply the weekly delta.
 *
 * No-op when categoryId is undefined, pointsDelta is 0, or the activity falls
 * before the challenge start (weekNumber ≤ 0).
 */
export async function applyWeeklyCategoryPointsDeltaFromDate(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    categoryId: Id<"categories"> | undefined;
    loggedDate: number;
    challengeStartDate: string | number;
    pointsDelta: number;
    metricDelta?: number;
    now?: number;
  }
) {
  if (!args.categoryId || (args.pointsDelta === 0 && (args.metricDelta ?? 0) === 0)) return;

  const weekNumber = getChallengeWeekNumber(
    args.challengeStartDate,
    args.loggedDate
  );
  if (weekNumber <= 0) return;

  await applyWeeklyCategoryPointsDelta(ctx, {
    userId: args.userId,
    challengeId: args.challengeId,
    categoryId: args.categoryId,
    weekNumber,
    pointsDelta: args.pointsDelta,
    metricDelta: args.metricDelta,
    now: args.now,
  });
}
