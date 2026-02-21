import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { notDeleted } from "./activityFilters";

type QueryDbCtx = Pick<QueryCtx, "db">;

/**
 * Build a map of challenge points keyed by userId from non-deleted activities.
 * This is the source of truth for leaderboard/user totals in read paths.
 */
export async function getChallengePointsByUser(
  ctx: QueryDbCtx,
  challengeId: Id<"challenges">
) {
  const activities = await ctx.db
    .query("activities")
    .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
    .filter(notDeleted)
    .collect();

  const pointsByUser = new Map<string, number>();
  for (const activity of activities) {
    const key = activity.userId as string;
    pointsByUser.set(key, (pointsByUser.get(key) ?? 0) + activity.pointsEarned);
  }

  return pointsByUser;
}

export function getPointsForUser(
  pointsByUser: Map<string, number>,
  userId: Id<"users">
) {
  return pointsByUser.get(userId as string) ?? 0;
}
