import type { DataModel } from "@repo/backend/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/_generated/server";
import { aggregateInsertActivity } from "@repo/backend/lib/activityPointsAggregate";

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
  return activityId;
}
