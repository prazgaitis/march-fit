import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const activityPointsAggregate = new TableAggregate<{
  Namespace: Id<"challenges">;
  Key: [Id<"users">, Id<"activities">];
  DataModel: DataModel;
  TableName: "activities";
}>(components.activityPointsAggregate, {
  namespace: (doc) => doc.challengeId,
  sortKey: (doc) => [doc.userId, doc._id],
  sumValue: (doc) => (doc.deletedAt === undefined ? doc.pointsEarned : 0),
});

type QueryAggregateCtx = Pick<QueryCtx, "runQuery">;
type MutationAggregateCtx = Pick<MutationCtx, "runMutation">;

export async function getChallengePointTotalForUser(
  ctx: QueryAggregateCtx,
  challengeId: Id<"challenges">,
  userId: Id<"users">,
) {
  const totals = await getChallengePointTotalsForUsers(ctx, challengeId, [userId]);
  return totals.get(userId) ?? 0;
}

export async function getChallengePointTotalsForUsers(
  ctx: QueryAggregateCtx,
  challengeId: Id<"challenges">,
  userIds: readonly Id<"users">[],
) {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) {
    return new Map<Id<"users">, number>();
  }

  const sums = await activityPointsAggregate.sumBatch(
    ctx,
    uniqueUserIds.map((userId) => ({
      namespace: challengeId,
      bounds: { prefix: [userId] },
    })),
  );

  const totals = new Map<Id<"users">, number>();
  for (let i = 0; i < uniqueUserIds.length; i += 1) {
    totals.set(uniqueUserIds[i], sums[i] ?? 0);
  }
  return totals;
}

export async function aggregateInsertActivity(
  ctx: MutationAggregateCtx,
  doc: DataModel["activities"]["document"],
) {
  await activityPointsAggregate.insertIfDoesNotExist(ctx, doc);
}

export async function aggregateReplaceActivity(
  ctx: MutationAggregateCtx,
  oldDoc: DataModel["activities"]["document"],
  newDoc: DataModel["activities"]["document"],
) {
  await activityPointsAggregate.replaceOrInsert(ctx, oldDoc, newDoc);
}

export async function aggregateDeleteActivity(
  ctx: MutationAggregateCtx,
  doc: DataModel["activities"]["document"],
) {
  await activityPointsAggregate.deleteIfExists(ctx, doc);
}
