import type { DataModel } from "@repo/backend/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/_generated/server";
import { aggregateInsertActivity } from "@repo/backend/lib/activityPointsAggregate";
import { applyWeeklyPointsDelta } from "@repo/backend/lib/weeklyPoints";
import { getChallengeWeekNumber } from "@repo/backend/lib/weeks";

export async function insertTestActivity(
  ctx: Pick<MutationCtx, "db" | "runMutation">,
  value: Omit<DataModel["activities"]["document"], "_id" | "_creationTime">,
) {
  const activityId = await ctx.db.insert("activities", value);
  const activity = await ctx.db.get(activityId);
  if (!activity) {
    throw new Error("Failed to load inserted activity in tests");
  }
  await aggregateInsertActivity(ctx, activity);

  // Maintain weeklyPoints aggregation (mirrors the production write path).
  // Skip for deleted activities — they contribute 0 points.
  if (!activity.deletedAt) {
    const activityType = await ctx.db.get(activity.activityTypeId);
    const challenge = await ctx.db.get(activity.challengeId);
    if (activityType?.categoryId && challenge) {
      const weekNumber = getChallengeWeekNumber(
        (challenge as any).startDate,
        activity.loggedDate,
      );
      await applyWeeklyPointsDelta(ctx, {
        userId: activity.userId,
        challengeId: activity.challengeId,
        categoryId: activityType.categoryId,
        weekNumber,
        pointsDelta: activity.pointsEarned,
      });
    }
  }

  return activityId;
}
