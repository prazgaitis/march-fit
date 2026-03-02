import { describe, it, expect } from "vitest";
import {
  computeContentScore,
  computeEngagementScore,
  computeFeedScore,
  computeTimeDecay,
  computeDisplayScore,
  FOLLOWING_BOOST,
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
    expect(computeContentScore({ ...base, notesLength: 25 })).toBe(1 + 2);
  });

  it("boosts medium descriptions (50-99 chars)", () => {
    expect(computeContentScore({ ...base, notesLength: 75 })).toBe(1 + 5);
  });

  it("boosts long descriptions (100+ chars)", () => {
    expect(computeContentScore({ ...base, notesLength: 150 })).toBe(1 + 8);
  });

  it("boosts media: +5 per item, capped at 15", () => {
    expect(computeContentScore({ ...base, mediaCount: 1 })).toBe(1 + 5);
    expect(computeContentScore({ ...base, mediaCount: 2 })).toBe(1 + 10);
    expect(computeContentScore({ ...base, mediaCount: 3 })).toBe(1 + 15);
    expect(computeContentScore({ ...base, mediaCount: 5 })).toBe(1 + 15); // capped
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
      notesLength: 120,  // +8
      mediaCount: 2,     // +10
      pointsEarned: 15,  // log2(16)*2 = 8
      triggeredBonusCount: 2, // +8
      flagged: false,
    };
    expect(computeContentScore(rich)).toBe(1 + 8 + 10 + 8 + 8);
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

// ── Time decay ─────────────────────────────────────────────────

describe("computeTimeDecay", () => {
  const now = Date.now();
  const HOUR = 1000 * 60 * 60;

  it("returns 1.0 for brand new activity", () => {
    expect(computeTimeDecay(now, now)).toBe(1);
  });

  it("returns ~0.5 at 24 hours", () => {
    expect(computeTimeDecay(now - 24 * HOUR, now)).toBeCloseTo(0.5, 5);
  });

  it("returns ~0.25 at 72 hours", () => {
    expect(computeTimeDecay(now - 72 * HOUR, now)).toBeCloseTo(0.25, 5);
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
    const score = computeDisplayScore(30, true, now - 24 * HOUR, now);
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
});
