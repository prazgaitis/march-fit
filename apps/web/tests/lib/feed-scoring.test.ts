import { describe, it, expect } from "vitest";
import {
  computeContentScore,
  computeEngagementScore,
  computeFeedScore,
  computeFeedRank,
  computePersonalizedRank,
  getRankInFeedBucket,
  computeTimeDecay,
  computeDisplayScore,
  FOLLOWING_BOOST,
  FEED_RANK_BUCKET_SPAN,
  FEED_RANK_MAX_WITHIN_BUCKET,
  computeAffinityBoost,
  MAX_AFFINITY_BOOST,
  type ContentScoreInput,
  type EngagementScoreInput,
} from "../../../../packages/backend/lib/feedScoring";

// ── helpers ────────────────────────────────────────────────────

const base: ContentScoreInput = {
  notesLength: 0,
  mediaCount: 0,
  pointsEarned: 0,
  triggeredBonusCount: 0,
  flagged: false,
};

const noEngagement: EngagementScoreInput = { likeCount: 0, commentCount: 0 };

// ── Content score ──────────────────────────────────────────────

describe("computeContentScore", () => {
  it("returns base score for empty activity", () => {
    expect(computeContentScore(base)).toBe(1);
  });

  it("boosts short descriptions (20-49 chars)", () => {
    expect(computeContentScore({ ...base, notesLength: 25 })).toBe(1 + 4);
  });

  it("boosts medium descriptions (50-99 chars)", () => {
    expect(computeContentScore({ ...base, notesLength: 75 })).toBe(1 + 10);
  });

  it("boosts long descriptions (100+ chars)", () => {
    expect(computeContentScore({ ...base, notesLength: 150 })).toBe(1 + 16);
  });

  it("boosts media: +10 per item, capped at 30", () => {
    expect(computeContentScore({ ...base, mediaCount: 1 })).toBe(1 + 10);
    expect(computeContentScore({ ...base, mediaCount: 2 })).toBe(1 + 20);
    expect(computeContentScore({ ...base, mediaCount: 3 })).toBe(1 + 30);
    expect(computeContentScore({ ...base, mediaCount: 5 })).toBe(1 + 30); // capped
  });

  it("boosts points earned (log-scaled, capped at 12)", () => {
    const score5 = computeContentScore({ ...base, pointsEarned: 5 });
    const score50 = computeContentScore({ ...base, pointsEarned: 50 });
    expect(score5).toBeGreaterThan(1);
    expect(score50).toBeGreaterThan(score5);
    // Very large points should still cap
    const score10k = computeContentScore({ ...base, pointsEarned: 10000 });
    expect(score10k).toBeLessThanOrEqual(1 + 12);
  });

  it("boosts triggered bonuses (+4 each, capped at 16)", () => {
    expect(computeContentScore({ ...base, triggeredBonusCount: 1 })).toBe(1 + 4);
    expect(computeContentScore({ ...base, triggeredBonusCount: 4 })).toBe(1 + 16);
    expect(computeContentScore({ ...base, triggeredBonusCount: 10 })).toBe(1 + 16); // capped
  });

  it("applies flag penalty", () => {
    expect(computeContentScore({ ...base, flagged: true })).toBe(1 - 100);
    // Flag penalty should overpower all boosts
    const flaggedWithEverything: ContentScoreInput = {
      notesLength: 200,
      mediaCount: 5,
      pointsEarned: 100,
      triggeredBonusCount: 5,
      flagged: true,
    };
    expect(computeContentScore(flaggedWithEverything)).toBe(-99);
  });

  it("stacks multiple boosts", () => {
    const rich: ContentScoreInput = {
      notesLength: 120,  // +16
      mediaCount: 2,     // +20
      pointsEarned: 15,  // log2(16)*2 = 8
      triggeredBonusCount: 2, // +8
      flagged: false,
    };
    expect(computeContentScore(rich)).toBe(1 + 16 + 20 + 8 + 8);
  });

  it("handles zero/negative points gracefully", () => {
    expect(computeContentScore({ ...base, pointsEarned: 0 })).toBe(1);
    expect(computeContentScore({ ...base, pointsEarned: -5 })).toBe(1);
  });
});

// ── Engagement score ───────────────────────────────────────────

describe("computeEngagementScore", () => {
  it("returns 0 for no engagement", () => {
    expect(computeEngagementScore(noEngagement)).toBe(0);
  });

  it("scores likes at 3 points each, capped at 30", () => {
    expect(computeEngagementScore({ likeCount: 1, commentCount: 0 })).toBe(3);
    expect(computeEngagementScore({ likeCount: 5, commentCount: 0 })).toBe(15);
    expect(computeEngagementScore({ likeCount: 10, commentCount: 0 })).toBe(30);
    expect(computeEngagementScore({ likeCount: 20, commentCount: 0 })).toBe(30); // capped
  });

  it("scores comments at 5 points each, capped at 30", () => {
    expect(computeEngagementScore({ likeCount: 0, commentCount: 1 })).toBe(5);
    expect(computeEngagementScore({ likeCount: 0, commentCount: 6 })).toBe(30);
    expect(computeEngagementScore({ likeCount: 0, commentCount: 10 })).toBe(30); // capped
  });

  it("caps likes and comments independently", () => {
    expect(computeEngagementScore({ likeCount: 20, commentCount: 20 })).toBe(60);
  });
});

// ── Combined feed score ────────────────────────────────────────

describe("computeFeedScore", () => {
  it("sums content and engagement", () => {
    const content: ContentScoreInput = { ...base, notesLength: 50 };
    const engagement: EngagementScoreInput = { likeCount: 2, commentCount: 1 };
    expect(computeFeedScore(content, engagement)).toBe(
      computeContentScore(content) + computeEngagementScore(engagement),
    );
  });
});

describe("computeFeedRank", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("clamps rank contribution to the bucket max", () => {
    const rank = computeFeedRank(10_000, 0);
    expect(rank).toBe(FEED_RANK_MAX_WITHIN_BUCKET);
  });

  it("uses a softer day-boundary step for cross-bucket ranking", () => {
    const justBeforeNextDay = DAY_MS - 1;
    const nextDayStart = DAY_MS;

    const oldStrong = computeFeedRank(FEED_RANK_MAX_WITHIN_BUCKET, justBeforeNextDay);
    const newWeak = computeFeedRank(0, nextDayStart);

    expect(newWeak - oldStrong).toBe(1);
    expect(newWeak).toBe(FEED_RANK_BUCKET_SPAN);
    expect(getRankInFeedBucket(oldStrong, justBeforeNextDay)).toBe(
      FEED_RANK_MAX_WITHIN_BUCKET,
    );
    expect(getRankInFeedBucket(newWeak, nextDayStart)).toBe(0);
  });

  it("allows strong social signals to buoy older posts across a boundary", () => {
    const prevDay = DAY_MS - 1;
    const nextDay = DAY_MS;

    const olderBaseRank = computeFeedRank(FEED_RANK_MAX_WITHIN_BUCKET, prevDay);
    const newerBaseRank = computeFeedRank(0, nextDay);

    const olderWithSocial = computePersonalizedRank(olderBaseRank, true, 100);
    const newerWithoutSocial = computePersonalizedRank(newerBaseRank, false, 0);

    expect(olderWithSocial).toBeGreaterThan(newerWithoutSocial);
  });
});

// ── Time decay ─────────────────────────────────────────────────

describe("computeTimeDecay", () => {
  const now = Date.now();
  const HOUR = 1000 * 60 * 60;

  it("returns 1.0 for brand new activity", () => {
    expect(computeTimeDecay(now, now)).toBe(1);
  });

  it("returns ~0.5 at 4 hours", () => {
    expect(computeTimeDecay(now - 4 * HOUR, now)).toBeCloseTo(0.5, 5);
  });

  it("returns ~0.25 at 12 hours", () => {
    expect(computeTimeDecay(now - 12 * HOUR, now)).toBeCloseTo(0.25, 5);
  });

  it("never returns negative", () => {
    expect(computeTimeDecay(now - 365 * 24 * HOUR, now)).toBeGreaterThan(0);
  });

  it("handles future timestamps gracefully (clamps to 1)", () => {
    expect(computeTimeDecay(now + HOUR, now)).toBe(1);
  });
});

// ── Display score (end-to-end) ─────────────────────────────────

describe("computeDisplayScore", () => {
  const now = Date.now();
  const HOUR = 1000 * 60 * 60;

  it("returns feedScore * 1.0 for brand new non-followed activity", () => {
    expect(computeDisplayScore(30, false, now, now)).toBe(30);
  });

  it("adds following boost", () => {
    expect(computeDisplayScore(30, true, now, now)).toBe(30 + FOLLOWING_BOOST);
  });

  it("applies time decay to the boosted score", () => {
    const score = computeDisplayScore(30, true, now - 4 * HOUR, now);
    expect(score).toBeCloseTo((30 + FOLLOWING_BOOST) * 0.5, 5);
  });

  it("ranks rich recent content above bland old content", () => {
    const richRecent = computeDisplayScore(40, false, now - 1 * HOUR, now);
    const blandOld = computeDisplayScore(5, false, now - 48 * HOUR, now);
    expect(richRecent).toBeGreaterThan(blandOld);
  });

  it("following boost can overcome lower content score", () => {
    const lowFollowed = computeDisplayScore(10, true, now, now);
    const highUnfollowed = computeDisplayScore(20, false, now, now);
    // 10 + 15 = 25 > 20
    expect(lowFollowed).toBeGreaterThan(highUnfollowed);
  });

  it("applies affinity boost in addition to follow boost", () => {
    const withAffinity = computeDisplayScore(30, false, now, now, 50);
    expect(withAffinity).toBeCloseTo(30 + computeAffinityBoost(50), 5);

    const withBoth = computeDisplayScore(30, true, now, now, 80);
    expect(withBoth).toBeCloseTo(
      30 + FOLLOWING_BOOST + computeAffinityBoost(80),
      5,
    );
  });
});

describe("computeAffinityBoost", () => {
  it("returns 0 for non-positive affinity", () => {
    expect(computeAffinityBoost(0)).toBe(0);
    expect(computeAffinityBoost(-5)).toBe(0);
  });

  it("scales linearly up to the max cap", () => {
    expect(computeAffinityBoost(25)).toBeCloseTo(MAX_AFFINITY_BOOST * 0.25, 5);
    expect(computeAffinityBoost(50)).toBeCloseTo(MAX_AFFINITY_BOOST * 0.5, 5);
  });

  it("caps boost at MAX_AFFINITY_BOOST", () => {
    expect(computeAffinityBoost(100)).toBe(MAX_AFFINITY_BOOST);
    expect(computeAffinityBoost(1000)).toBe(MAX_AFFINITY_BOOST);
  });
});
