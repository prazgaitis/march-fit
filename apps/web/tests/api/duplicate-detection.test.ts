import { describe, it, expect } from "vitest";
import {
  isWithinTolerance,
  compareMetrics,
  findPotentialDuplicates,
  type CandidateActivity,
  type StravaActivityForDuplicateCheck,
} from "@repo/backend/lib/duplicateDetection";
import type { Id } from "@repo/backend/_generated/dataModel";

// Helper to create a candidate activity with defaults
function makeCandidate(
  overrides: Partial<CandidateActivity> & {
    loggedDateStr?: string;
  } = {},
): CandidateActivity {
  const { loggedDateStr, ...rest } = overrides;
  const dateStr = loggedDateStr ?? "2024-01-15";
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    _id: "activity_123" as Id<"activities">,
    activityTypeId: "activityType_abc" as Id<"activityTypes">,
    loggedDate: Date.UTC(y, m - 1, d),
    metrics: { minutes: 40, distance_miles: 5.0 },
    source: "manual",
    notes: null,
    pointsEarned: 45,
    ...rest,
  };
}

function makeStravaCheck(
  overrides: Partial<StravaActivityForDuplicateCheck> = {},
): StravaActivityForDuplicateCheck {
  return {
    loggedDateStr: "2024-01-15",
    activityTypeId: "activityType_abc",
    metrics: { minutes: 40, distance_miles: 5.0 },
    ...overrides,
  };
}

// ===========================
// isWithinTolerance tests
// ===========================

describe("isWithinTolerance", () => {
  it("returns true for identical values", () => {
    expect(isWithinTolerance(100, 100, 0.15)).toBe(true);
  });

  it("returns true for values within tolerance", () => {
    // 100 vs 110 = 10% difference, within 15% tolerance
    expect(isWithinTolerance(100, 110, 0.15)).toBe(true);
  });

  it("returns false for values outside tolerance", () => {
    // 100 vs 120 = 20% difference, outside 15% tolerance
    expect(isWithinTolerance(100, 120, 0.15)).toBe(false);
  });

  it("returns true for both zeros", () => {
    expect(isWithinTolerance(0, 0, 0.15)).toBe(true);
  });

  it("returns false when one value is zero and other is not", () => {
    expect(isWithinTolerance(0, 10, 0.15)).toBe(false);
  });

  it("handles reversed argument order", () => {
    expect(isWithinTolerance(110, 100, 0.15)).toBe(true);
    expect(isWithinTolerance(120, 100, 0.15)).toBe(false);
  });

  it("handles exact boundary", () => {
    // 100 vs 115 = 15/115 ≈ 13.04% difference, within 15%
    expect(isWithinTolerance(100, 115, 0.15)).toBe(true);
  });

  it("handles small values", () => {
    // 1.0 vs 1.1 = 10% difference
    expect(isWithinTolerance(1.0, 1.1, 0.15)).toBe(true);
  });
});

// ===========================
// compareMetrics tests
// ===========================

describe("compareMetrics", () => {
  it("returns high confidence when both duration and distance match", () => {
    const result = compareMetrics(
      { minutes: 40, distance_miles: 5.0 },
      { minutes: 42, distance_miles: 5.1 },
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain("Duration similar");
    expect(result.reasons[1]).toContain("Distance similar");
  });

  it("returns medium confidence when only duration matches", () => {
    const result = compareMetrics(
      { minutes: 40, distance_miles: 5.0 },
      { minutes: 42, distance_miles: 10.0 }, // very different distance
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("Duration");
  });

  it("returns medium confidence when only distance matches", () => {
    const result = compareMetrics(
      { minutes: 40, distance_miles: 5.0 },
      { minutes: 80, distance_miles: 5.1 }, // very different duration
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("Distance");
  });

  it("returns no match when neither duration nor distance match", () => {
    const result = compareMetrics(
      { minutes: 40, distance_miles: 5.0 },
      { minutes: 80, distance_miles: 10.0 },
    );
    expect(result.matched).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("matches using km when miles not available", () => {
    const result = compareMetrics(
      { minutes: 40, distance_km: 8.0 },
      { minutes: 42, distance_km: 8.5 },
    );
    expect(result.matched).toBe(true);
    expect(result.reasons.some((r) => r.includes("km"))).toBe(true);
  });

  it("handles missing distance metrics gracefully", () => {
    const result = compareMetrics(
      { minutes: 40 },
      { minutes: 42 },
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toHaveLength(1);
  });

  it("handles missing duration gracefully", () => {
    const result = compareMetrics(
      { distance_miles: 5.0 },
      { distance_miles: 5.1 },
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("handles empty metrics", () => {
    const result = compareMetrics({}, {});
    expect(result.matched).toBe(false);
  });

  it("uses 'miles' key as fallback for distance_miles", () => {
    const result = compareMetrics(
      { minutes: 30, miles: 3.0 },
      { minutes: 30, miles: 3.1 },
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("uses 'kilometers' key as fallback for distance_km", () => {
    const result = compareMetrics(
      { minutes: 30, kilometers: 5.0 },
      { minutes: 30, kilometers: 5.2 },
    );
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("high");
  });
});

// ===========================
// findPotentialDuplicates tests
// ===========================

describe("findPotentialDuplicates", () => {
  it("finds a duplicate when date, type, and metrics match", () => {
    const stravaActivities = [
      makeStravaCheck({
        loggedDateStr: "2024-01-15",
        activityTypeId: "activityType_abc",
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        loggedDateStr: "2024-01-15",
        activityTypeId: "activityType_abc" as Id<"activityTypes">,
        metrics: { minutes: 42, distance_miles: 5.1 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(1);
    expect(result.get(0)!.confidence).toBe("high");
    expect(result.get(0)!.activityId).toBe("activity_123");
  });

  it("does not flag duplicate when dates differ", () => {
    const stravaActivities = [
      makeStravaCheck({
        loggedDateStr: "2024-01-15",
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        loggedDateStr: "2024-01-16",
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(0);
  });

  it("flags duplicate even when activity types differ (user may have logged wrong type)", () => {
    const stravaActivities = [
      makeStravaCheck({
        activityTypeId: "activityType_abc",
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        activityTypeId: "activityType_xyz" as Id<"activityTypes">,
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(1);
    expect(result.get(0)!.confidence).toBe("high");
  });

  it("does not flag duplicate when metrics are very different", () => {
    const stravaActivities = [
      makeStravaCheck({
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        metrics: { minutes: 120, distance_miles: 15.0 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(0);
  });

  it("flags duplicate even when strava activity has no activityTypeId (unmapped)", () => {
    const stravaActivities = [
      makeStravaCheck({
        activityTypeId: null,
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(1);
    expect(result.get(0)!.confidence).toBe("high");
  });

  it("ignores non-manual activities", () => {
    const stravaActivities = [
      makeStravaCheck({
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        source: "strava",
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(0);
  });

  it("handles multiple strava activities with some duplicates", () => {
    const stravaActivities = [
      makeStravaCheck({
        loggedDateStr: "2024-01-15",
        activityTypeId: "activityType_abc",
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
      makeStravaCheck({
        loggedDateStr: "2024-01-16",
        activityTypeId: "activityType_abc",
        metrics: { minutes: 30, distance_miles: 3.0 },
      }),
      makeStravaCheck({
        loggedDateStr: "2024-01-17",
        activityTypeId: "activityType_abc",
        metrics: { minutes: 60, distance_miles: 8.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        _id: "activity_match1" as Id<"activities">,
        loggedDateStr: "2024-01-15",
        activityTypeId: "activityType_abc" as Id<"activityTypes">,
        metrics: { minutes: 41, distance_miles: 5.1 },
      }),
      // No match for Jan 16 (different metrics)
      makeCandidate({
        _id: "activity_nomatch" as Id<"activities">,
        loggedDateStr: "2024-01-16",
        activityTypeId: "activityType_abc" as Id<"activityTypes">,
        metrics: { minutes: 90, distance_miles: 12.0 },
      }),
      makeCandidate({
        _id: "activity_match3" as Id<"activities">,
        loggedDateStr: "2024-01-17",
        activityTypeId: "activityType_abc" as Id<"activityTypes">,
        metrics: { minutes: 62, distance_miles: 8.2 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
    expect(result.get(0)!.activityId).toBe("activity_match1");
    expect(result.get(2)!.activityId).toBe("activity_match3");
  });

  it("returns the first matching candidate when multiple candidates exist", () => {
    const stravaActivities = [
      makeStravaCheck({
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];
    const manualActivities = [
      makeCandidate({
        _id: "activity_first" as Id<"activities">,
        metrics: { minutes: 41, distance_miles: 5.1 },
      }),
      makeCandidate({
        _id: "activity_second" as Id<"activities">,
        metrics: { minutes: 40, distance_miles: 5.0 },
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(1);
    expect(result.get(0)!.activityId).toBe("activity_first");
  });

  it("empty strava activities returns empty map", () => {
    const result = findPotentialDuplicates([], [makeCandidate()]);
    expect(result.size).toBe(0);
  });

  it("empty manual activities returns empty map", () => {
    const result = findPotentialDuplicates([makeStravaCheck()], []);
    expect(result.size).toBe(0);
  });

  it("detects medium-confidence duplicate with only duration match", () => {
    const stravaActivities = [
      makeStravaCheck({
        metrics: { minutes: 40 }, // no distance
      }),
    ];
    const manualActivities = [
      makeCandidate({
        metrics: { minutes: 42 }, // no distance
      }),
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(1);
    expect(result.get(0)!.confidence).toBe("medium");
  });

  it("handles date edge case - UTC midnight boundary", () => {
    // loggedDate stored as UTC midnight for 2024-01-15
    const jan15Utc = Date.UTC(2024, 0, 15); // Jan 15, 2024 00:00:00 UTC

    const stravaActivities = [
      makeStravaCheck({
        loggedDateStr: "2024-01-15",
        metrics: { minutes: 40 },
      }),
    ];
    const manualActivities: CandidateActivity[] = [
      {
        _id: "activity_utc" as Id<"activities">,
        activityTypeId: "activityType_abc" as Id<"activityTypes">,
        loggedDate: jan15Utc,
        metrics: { minutes: 41 },
        source: "manual",
        notes: null,
        pointsEarned: 40,
      },
    ];

    const result = findPotentialDuplicates(stravaActivities, manualActivities);
    expect(result.size).toBe(1);
  });
});
