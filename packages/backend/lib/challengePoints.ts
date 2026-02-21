import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getChallengePointTotalsForUsers } from "./activityPointsAggregate";

type QueryDbCtx = Pick<QueryCtx, "db" | "runQuery">;

/**
 * Build a map of challenge points keyed by userId from non-deleted activities.
 * This is the source of truth for leaderboard/user totals in read paths.
 */
export async function getChallengePointsByUser(
  ctx: QueryDbCtx,
  challengeId: Id<"challenges">
) {
  const participationUserIds = await ctx.db
    .query("userChallenges")
    .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
    .collect();

  const userIds = participationUserIds.map((p) => p.userId);
  const totals = await getChallengePointTotalsForUsers(ctx, challengeId, userIds);

  const pointsByUser = new Map<string, number>();
  for (const [userId, total] of totals.entries()) {
    pointsByUser.set(userId as string, total);
  }

  return pointsByUser;
}

export function getPointsForUser(
  pointsByUser: Map<string, number>,
  userId: Id<"users">
) {
  return pointsByUser.get(userId as string) ?? 0;
}
