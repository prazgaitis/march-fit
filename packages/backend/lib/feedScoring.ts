/**
 * Pure feed-scoring functions.
 *
 * These are intentionally free of any Convex imports so they can be
 * unit-tested without the Convex runtime and reused across queries,
 * mutations, and backfill scripts.
 */

// ── Content score ──────────────────────────────────────────────

export interface ContentScoreInput {
  notesLength: number;
  mediaCount: number;
  pointsEarned: number;
  triggeredBonusCount: number;
  flagged: boolean;
}

const BASE_SCORE = 1;
const FLAG_PENALTY = -100;

function descriptionBoost(length: number): number {
  if (length >= 100) return 8;
  if (length >= 50) return 5;
  if (length >= 20) return 2;
  return 0;
}

function mediaBoost(count: number): number {
  return Math.min(count * 5, 15);
}

function pointsBoost(pointsEarned: number): number {
  if (pointsEarned <= 0) return 0;
  return Math.min(Math.log2(pointsEarned + 1) * 2, 12);
}

function bonusBoost(triggeredBonusCount: number): number {
  return Math.min(triggeredBonusCount * 4, 16);
}

export function computeContentScore(input: ContentScoreInput): number {
  if (input.flagged) return BASE_SCORE + FLAG_PENALTY;

  return (
    BASE_SCORE +
    descriptionBoost(input.notesLength) +
    mediaBoost(input.mediaCount) +
    pointsBoost(input.pointsEarned) +
    bonusBoost(input.triggeredBonusCount)
  );
}

// ── Engagement score ───────────────────────────────────────────

export interface EngagementScoreInput {
  likeCount: number;
  commentCount: number;
}

export function computeEngagementScore(input: EngagementScoreInput): number {
  return Math.min(input.likeCount * 3, 30) + Math.min(input.commentCount * 5, 30);
}

// ── Combined static feed score (stored on activity) ────────────

export function computeFeedScore(
  content: ContentScoreInput,
  engagement: EngagementScoreInput,
): number {
  return computeContentScore(content) + computeEngagementScore(engagement);
}

// ── Time-bucketed feed rank (stored on activity) ────────────────
//
// dayBucket * FEED_RANK_BUCKET_SPAN + clamp(feedScore, 0, FEED_RANK_MAX_WITHIN_BUCKET)
//
// This keeps today's posts always above yesterday's in index order,
// while still ranking within a day by quality/engagement.

export const FEED_BUCKET_DURATION_MS = 24 * 60 * 60 * 1000;
export const FEED_RANK_BUCKET_SPAN = 100;
export const FEED_RANK_MAX_WITHIN_BUCKET = FEED_RANK_BUCKET_SPAN - 1;

export function getFeedDayBucket(createdAtMs: number): number {
  return Math.floor(createdAtMs / FEED_BUCKET_DURATION_MS);
}

export function clampFeedRankWithinBucket(feedScore: number): number {
  return Math.max(0, Math.min(FEED_RANK_MAX_WITHIN_BUCKET, Math.round(feedScore)));
}

export function getRankInFeedBucket(feedRank: number, createdAtMs: number): number {
  return feedRank - getFeedDayBucket(createdAtMs) * FEED_RANK_BUCKET_SPAN;
}

export function computeFeedRank(feedScore: number, createdAtMs: number): number {
  const dayBucket = getFeedDayBucket(createdAtMs);
  const clamped = clampFeedRankWithinBucket(feedScore);
  return dayBucket * FEED_RANK_BUCKET_SPAN + clamped;
}

// ── Personalized rank (query time, per-viewer) ──────────────────

export const FOLLOWING_BOOST = 15;
export const MAX_AFFINITY_BOOST = 20;
export const MAX_AFFINITY_SCORE = 100;

export function computeAffinityBoost(affinityScore: number): number {
  if (affinityScore <= 0) return 0;
  const clampedScore = Math.min(MAX_AFFINITY_SCORE, affinityScore);
  return (clampedScore / MAX_AFFINITY_SCORE) * MAX_AFFINITY_BOOST;
}

export function computePersonalizedRank(
  feedRank: number,
  isFollowing: boolean,
  affinityScore: number = 0,
): number {
  return feedRank + (isFollowing ? FOLLOWING_BOOST : 0) + computeAffinityBoost(affinityScore);
}

// ── Time decay (applied at query time) ─────────────────────────

export function computeTimeDecay(createdAtMs: number, nowMs: number): number {
  const hoursAge = Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60));
  return 1 / (1 + hoursAge / 24);
}

// ── Final display score (query time) ───────────────────────────

export function computeDisplayScore(
  feedScore: number,
  isFollowing: boolean,
  createdAtMs: number,
  nowMs: number,
  affinityScore: number = 0,
): number {
  const personalized =
    feedScore + (isFollowing ? FOLLOWING_BOOST : 0) + computeAffinityBoost(affinityScore);
  return personalized * computeTimeDecay(createdAtMs, nowMs);
}
