import type { Id } from "../_generated/dataModel";

/**
 * Apply a points delta to the pre-aggregated categoryPoints table.
 *
 * Called by applyParticipationScoreDeltaAndRecomputeStreak (via optional categoryId)
 * and directly when an activity type changes (to unapply the old category before
 * the new one is applied through the normal path).
 *
 * No-op when categoryId is undefined (uncategorized activity type).
 */
export async function applyCategoryPointsDelta(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    categoryId: Id<"categories"> | undefined;
    pointsDelta: number;
    metricDelta?: number;
    now?: number;
  }
) {
  if (!args.categoryId || (args.pointsDelta === 0 && (args.metricDelta ?? 0) === 0)) return;

  const existing = await ctx.db
    .query("categoryPoints")
    .withIndex("challengeUserCategory", (q: any) =>
      q
        .eq("challengeId", args.challengeId)
        .eq("userId", args.userId)
        .eq("categoryId", args.categoryId)
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
    await ctx.db.insert("categoryPoints", {
      challengeId: args.challengeId,
      userId: args.userId,
      categoryId: args.categoryId,
      totalPoints: Math.max(0, args.pointsDelta),
      totalMetricValue: Math.max(0, metricDelta),
      updatedAt: ts,
    });
  }
}
