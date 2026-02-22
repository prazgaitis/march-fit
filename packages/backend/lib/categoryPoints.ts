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
    now?: number;
  }
) {
  if (!args.categoryId || args.pointsDelta === 0) return;

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

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalPoints: Math.max(0, existing.totalPoints + args.pointsDelta),
      updatedAt: ts,
    });
  } else if (args.pointsDelta > 0) {
    await ctx.db.insert("categoryPoints", {
      challengeId: args.challengeId,
      userId: args.userId,
      categoryId: args.categoryId,
      totalPoints: args.pointsDelta,
      updatedAt: ts,
    });
  }
}
