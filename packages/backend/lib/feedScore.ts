import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { computeFeedScore, computeFeedRank, type ContentScoreInput, type EngagementScoreInput } from "./feedScoring";

type Ctx = Pick<MutationCtx, "db">;

/**
 * Build ContentScoreInput from an activity document.
 */
function contentInputFromActivity(activity: Doc<"activities">): ContentScoreInput {
  return {
    hasDescription: !!activity.notes && activity.notes.trim().length > 0,
    mediaCount: (activity.mediaIds?.length ?? 0) + (activity.cloudinaryPublicIds?.length ?? 0),
    pointsEarned: activity.pointsEarned,
    triggeredBonusCount: activity.triggeredBonuses?.length ?? 0,
    flagged: activity.flagged,
  };
}

/**
 * Count likes and comments for an activity.
 */
async function getEngagementCounts(
  ctx: Ctx,
  activityId: Id<"activities">,
): Promise<EngagementScoreInput> {
  const [likes, comments] = await Promise.all([
    ctx.db
      .query("likes")
      .withIndex("activityId", (q) => q.eq("activityId", activityId))
      .collect()
      .then((rows) => rows.length),
    ctx.db
      .query("comments")
      .withIndex("activityId", (q) => q.eq("activityId", activityId))
      .collect()
      .then((rows) => rows.filter(r => !r.parentType || r.parentType === "activity").length),
  ]);
  return { likeCount: likes, commentCount: comments };
}

/**
 * Recompute and persist the feedScore for a single activity.
 * Call this after any mutation that changes content signals or engagement.
 */
export async function recomputeFeedScore(
  ctx: Ctx,
  activityId: Id<"activities">,
): Promise<void> {
  const activity = await ctx.db.get(activityId);
  if (!activity || activity.deletedAt) return;

  const content = contentInputFromActivity(activity);
  const engagement = await getEngagementCounts(ctx, activityId);
  const score = computeFeedScore(content, engagement);

  const rank = computeFeedRank(score, activity.createdAt);

  // Only write if the score actually changed to avoid unnecessary updates.
  if (activity.feedScore !== score || activity.feedRank !== rank) {
    await ctx.db.patch(activityId, { feedScore: score, feedRank: rank });
  }
}

/**
 * Compute the initial feed score and rank for an activity being created.
 * Avoids querying engagement counts (they're 0 at creation time).
 */
export function computeInitialFeedScoreAndRank(
  fields: Pick<Doc<"activities">, "notes" | "mediaIds" | "cloudinaryPublicIds" | "pointsEarned" | "triggeredBonuses" | "flagged" | "createdAt">,
): { feedScore: number; feedRank: number } {
  const content: ContentScoreInput = {
    hasDescription: !!fields.notes && fields.notes.trim().length > 0,
    mediaCount: (fields.mediaIds?.length ?? 0) + (fields.cloudinaryPublicIds?.length ?? 0),
    pointsEarned: fields.pointsEarned,
    triggeredBonusCount: fields.triggeredBonuses?.length ?? 0,
    flagged: fields.flagged,
  };
  const feedScore = computeFeedScore(content, { likeCount: 0, commentCount: 0 });
  const feedRank = computeFeedRank(feedScore, fields.createdAt);
  return { feedScore, feedRank };
}
