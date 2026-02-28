import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  aggregateDeleteActivity,
  aggregateInsertActivity,
  aggregateReplaceActivity,
} from "./activityPointsAggregate";

type MutationDbCtx = Pick<MutationCtx, "db" | "runMutation">;
type ActivityInsert = Omit<Doc<"activities">, "_id" | "_creationTime">;
type ActivityPatch = Partial<ActivityInsert> & {
  notes?: string | null;
  adminComment?: string | null;
};

export async function insertActivity(
  ctx: MutationDbCtx,
  value: ActivityInsert,
) {
  // Route externalData to the companion table to keep activity docs lightweight.
  const externalData = value.externalData;
  const insertValue = externalData !== undefined
    ? { ...value, externalData: undefined }
    : value;

  const activityId = await ctx.db.insert("activities", insertValue);
  const created = await ctx.db.get(activityId);
  if (!created) {
    throw new Error("Failed to load newly inserted activity");
  }
  await aggregateInsertActivity(ctx, created);

  if (externalData !== undefined) {
    await ctx.db.insert("activityExternalData", {
      activityId,
      externalData,
    });
  }

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

  // Route externalData to the companion table instead of the activity doc.
  let externalData: any;
  let activityPatch = patch;
  if ("externalData" in patch && patch.externalData !== undefined) {
    externalData = patch.externalData;
    const { externalData: _stripped, ...rest } = patch;
    activityPatch = rest as ActivityPatch;
  }

  await ctx.db.patch(activityId, activityPatch);
  const updated = await ctx.db.get(activityId);
  if (!updated) {
    throw new Error("Activity not found after patch");
  }
  await aggregateReplaceActivity(ctx, previous, updated);

  if (externalData !== undefined) {
    const existing = await ctx.db
      .query("activityExternalData")
      .withIndex("activityId", (q: any) => q.eq("activityId", activityId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { externalData });
    } else {
      await ctx.db.insert("activityExternalData", {
        activityId,
        externalData,
      });
    }
  }

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
