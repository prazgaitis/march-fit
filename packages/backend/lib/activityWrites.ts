import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  aggregateDeleteActivity,
  aggregateInsertActivity,
  aggregateReplaceActivity,
} from "./activityPointsAggregate";

type MutationDbCtx = Pick<MutationCtx, "db" | "runMutation">;
type ActivityInsert = Omit<Doc<"activities">, "_id" | "_creationTime">;
type ActivityPatch = Partial<ActivityInsert>;

export async function insertActivity(
  ctx: MutationDbCtx,
  value: ActivityInsert,
) {
  const activityId = await ctx.db.insert("activities", value);
  const created = await ctx.db.get(activityId);
  if (!created) {
    throw new Error("Failed to load newly inserted activity");
  }
  await aggregateInsertActivity(ctx, created);
  return activityId;
}

export async function patchActivity(
  ctx: MutationDbCtx,
  activityId: Id<"activities">,
  patch: ActivityPatch,
) {
  const previous = await ctx.db.get(activityId);
  if (!previous) {
    throw new Error("Activity not found");
  }
  await ctx.db.patch(activityId, patch);
  const updated = await ctx.db.get(activityId);
  if (!updated) {
    throw new Error("Activity not found after patch");
  }
  await aggregateReplaceActivity(ctx, previous, updated);
  return updated;
}

export async function deleteActivity(ctx: MutationDbCtx, activityId: Id<"activities">) {
  const previous = await ctx.db.get(activityId);
  if (!previous) {
    return;
  }
  await ctx.db.delete(activityId);
  await aggregateDeleteActivity(ctx, previous);
}
