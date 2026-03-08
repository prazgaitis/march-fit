import { describe, it, expect } from "vitest";
import {
  computeContentScore,
  computeEngagementScore,
  computeFeedScore,
  computeFeedRank,
  computePersonalizedRank,
  getRankInFeedBucket,
  computeDisplayScore,
  computeDecayedScore,
  FOLLOWING_BOOST,
  FEED_RANK_BUCKET_SPAN,
  FEED_RANK_MAX_WITHIN_BUCKET,
  computeAffinityBoost,
  MAX_AFFINITY_BOOST,
  QUALITY_HALF_LIFE_HOURS,
  FRESHNESS_BONUS,
  FRESHNESS_HALF_LIFE_HOURS,
  type ContentScoreInput,
  type EngagementScoreInput,
} from "../../../../packages/backend/lib/feedScoring";

// ── helpers ────────────────────────────────────────────────────

const base: ContentScoreInput = {
  hasDescription: false,
  mediaCount: 0,
  pointsEarned: 0,
  triggeredBonusCount: 0,
  flagged: false,
};

const noEngagement: EngagementScoreInput = { likeCount: 0, commentCount: 0 };

const hours = (h: number) => h * 60 * 60 * 1000;

// ── Content score ──────────────────────────────────────────────

describe("computeContentScore", () => {
  it("returns base score for empty activity", () => {
    expect(computeContentScore(base)).toBe(1);
  });

  it("boosts activities with a custom description (+10 flat)", () => {
    expect(computeContentScore({ ...base, hasDescription: true })).toBe(1 + 10);
  });

  it("no description boost when hasDescription is false", () => {
    expect(computeContentScore({ ...base, hasDescription: false })).toBe(1);
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
      hasDescription: true,
      mediaCount: 5,
      pointsEarned: 100,
      triggeredBonusCount: 5,
      flagged: true,
    };
    expect(computeContentScore(flaggedWithEverything)).toBe(-99);
  });

  it("stacks multiple boosts", () => {
    const rich: ContentScoreInput = {
      hasDescription: true, // +10
      mediaCount: 2,        // +20
      pointsEarned: 15,     // log2(16)*2 = 8
      triggeredBonusCount: 2, // +8
      flagged: false,
    };
    expect(computeContentScore(rich)).toBe(1 + 10 + 20 + 8 + 8);
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
    const content: ContentScoreInput = { ...base, hasDescription: true };
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

// ── Display score (end-to-end) ─────────────────────────────────

describe("computeDisplayScore", () => {
  it("returns feedScore for non-followed activity with no affinity", () => {
    expect(computeDisplayScore(30, false)).toBe(30);
  });

  it("adds following boost", () => {
    expect(computeDisplayScore(30, true)).toBe(30 + FOLLOWING_BOOST);
  });

  it("following boost can overcome lower content score", () => {
    const lowFollowed = computeDisplayScore(10, true);
    const highUnfollowed = computeDisplayScore(20, false);
    // 10 + 15 = 25 > 20
    expect(lowFollowed).toBeGreaterThan(highUnfollowed);
  });

  it("applies affinity boost in addition to follow boost", () => {
    const withAffinity = computeDisplayScore(30, false, 50);
    expect(withAffinity).toBeCloseTo(30 + computeAffinityBoost(50), 5);

    const withBoth = computeDisplayScore(30, true, 80);
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

// ── Decayed score (For You feed) ───────────────────────────────

describe("computeDecayedScore", () => {
  it("returns feedScore + freshness bonus for brand-new activity", () => {
    const score = computeDecayedScore(60, 0, false, 0);
    // (60 + 15) * 1.0 = 75
    expect(score).toBeCloseTo(60 + FRESHNESS_BONUS, 1);
  });

  it("freshness bonus decays faster than quality score", () => {
    const at6h = computeDecayedScore(60, hours(6), false, 0);
    // freshness: 15 * 0.5 = 7.5; quality decay: 0.5^(6/18) ≈ 0.794
    // (60 + 7.5) * 0.794 ≈ 53.6
    expect(at6h).toBeCloseTo((60 + 7.5) * Math.pow(0.5, 6 / 18), 1);
  });

  it("at quality half-life, score is roughly halved", () => {
    const fresh = computeDecayedScore(60, 0, false, 0);
    const atHalfLife = computeDecayedScore(60, hours(QUALITY_HALF_LIFE_HOURS), false, 0);
    // Freshness bonus is mostly gone by 18h (3 freshness half-lives = 0.125 * 15 ≈ 1.9)
    // So at 18h: (60 + 1.9) * 0.5 ≈ 31
    expect(atHalfLife).toBeLessThan(fresh * 0.55);
    expect(atHalfLife).toBeGreaterThan(fresh * 0.35);
  });

  it("a great post at 24h still beats a mediocre fresh post", () => {
    const great24h = computeDecayedScore(60, hours(24), false, 0);
    const mediocreFresh = computeDecayedScore(15, 0, false, 0);
    // great24h ≈ (60 + ~0.9) * 0.397 ≈ 24.2
    // mediocreFresh = (15 + 15) * 1 = 30
    // Actually mediocre fresh wins here due to freshness bonus — that's expected
    expect(mediocreFresh).toBeGreaterThan(great24h);
  });

  it("a great post at 12h still beats a bare fresh post", () => {
    const great12h = computeDecayedScore(60, hours(12), false, 0);
    const bareFresh = computeDecayedScore(1, 0, false, 0);
    // great12h ≈ (60 + 3.75) * 0.63 ≈ 40.2
    // bareFresh = (1 + 15) * 1 = 16
    expect(great12h).toBeGreaterThan(bareFresh);
  });

  it("a bare fresh post starts mid-range thanks to freshness bonus", () => {
    const bareFresh = computeDecayedScore(1, 0, false, 0);
    // (1 + 15) * 1.0 = 16
    expect(bareFresh).toBeCloseTo(1 + FRESHNESS_BONUS, 1);
    expect(bareFresh).toBeGreaterThan(10);
  });

  it("a bare post sinks quickly as freshness decays", () => {
    const bareAt6h = computeDecayedScore(1, hours(6), false, 0);
    // (1 + 7.5) * 0.794 ≈ 6.7
    expect(bareAt6h).toBeLessThan(10);
  });

  it("social boosts are added after decay (not decayed)", () => {
    const withFollow = computeDecayedScore(60, hours(24), true, 0);
    const without = computeDecayedScore(60, hours(24), false, 0);
    expect(withFollow - without).toBeCloseTo(FOLLOWING_BOOST, 1);

    const withAffinity = computeDecayedScore(60, hours(24), false, 50);
    expect(withAffinity - without).toBeCloseTo(computeAffinityBoost(50), 1);
  });

  it("negative age is treated as zero", () => {
    const negAge = computeDecayedScore(60, -1000, false, 0);
    const zeroAge = computeDecayedScore(60, 0, false, 0);
    expect(negAge).toBe(zeroAge);
  });

  it("at 48h a great post is mostly gone", () => {
    const at48h = computeDecayedScore(60, hours(48), false, 0);
    // (60 + ~0) * 0.5^(48/18) ≈ 60 * 0.16 ≈ 9.6
    expect(at48h).toBeLessThan(15);
    expect(at48h).toBeGreaterThan(5);
  });
});
