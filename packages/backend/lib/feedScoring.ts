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
// dayBucket * 1000 + clamp(feedScore, 0, 999)
//
// This keeps today's posts always above yesterday's in index order,
// while still ranking within a day by quality/engagement.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeFeedRank(feedScore: number, createdAtMs: number): number {
  const dayBucket = Math.floor(createdAtMs / MS_PER_DAY);
  const clamped = Math.max(0, Math.min(999, Math.round(feedScore)));
  return dayBucket * 1000 + clamped;
}

// ── Personalized rank (query time, per-viewer) ──────────────────

export const FOLLOWING_BOOST = 15;

export function computePersonalizedRank(
  feedRank: number,
  isFollowing: boolean,
): number {
  return feedRank + (isFollowing ? FOLLOWING_BOOST : 0);
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
): number {
  const personalized = feedScore + (isFollowing ? FOLLOWING_BOOST : 0);
  return personalized * computeTimeDecay(createdAtMs, nowMs);
}
