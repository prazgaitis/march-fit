import { describe, it, expect } from "vitest";
import {
  extractActivityMetricValue,
  getMetricValueForUnit,
} from "../../../../packages/backend/lib/scoring";

describe("extractActivityMetricValue", () => {
  it("returns 0 when scoringConfig has no unit", () => {
    const activityType = {
      scoringConfig: { type: "fixed", basePoints: 10 },
    };
    expect(extractActivityMetricValue(activityType, { miles: 5 })).toBe(0);
  });

  it("returns 0 when scoringConfig is undefined", () => {
    const activityType = {};
    expect(extractActivityMetricValue(activityType, { miles: 5 })).toBe(0);
  });

  it("extracts metric value using exact unit key", () => {
    const activityType = {
      scoringConfig: { unit: "miles", pointsPerUnit: 10 },
    };
    expect(
      extractActivityMetricValue(activityType, { miles: 5.5 })
    ).toBe(5.5);
  });

  it("extracts metric value using alias (distance_miles → miles)", () => {
    const activityType = {
      scoringConfig: { unit: "miles", pointsPerUnit: 10 },
    };
    expect(
      extractActivityMetricValue(activityType, { distance_miles: 26.2 })
    ).toBe(26.2);
  });

  it("extracts minutes from duration_minutes alias", () => {
    const activityType = {
      scoringConfig: { unit: "minutes", pointsPerUnit: 1 },
    };
    expect(
      extractActivityMetricValue(activityType, { duration_minutes: 45 })
    ).toBe(45);
  });

  it("returns 0 when the metric is missing from the activity", () => {
    const activityType = {
      scoringConfig: { unit: "miles", pointsPerUnit: 10 },
    };
    expect(extractActivityMetricValue(activityType, {})).toBe(0);
  });

  it("returns 0 for non-numeric metric values", () => {
    const activityType = {
      scoringConfig: { unit: "miles", pointsPerUnit: 10 },
    };
    expect(
      extractActivityMetricValue(activityType, { miles: "not-a-number" })
    ).toBe(0);
  });
});

describe("getMetricValueForUnit", () => {
  it("returns undefined when unit is undefined", () => {
    expect(getMetricValueForUnit(undefined, { miles: 5 })).toBeUndefined();
  });

  it("resolves exact key match", () => {
    expect(getMetricValueForUnit("miles", { miles: 10 })).toBe(10);
  });

  it("resolves canonical aliases for miles", () => {
    expect(getMetricValueForUnit("miles", { distance_miles: 3.1 })).toBe(3.1);
  });

  it("resolves canonical aliases for kilometers", () => {
    expect(
      getMetricValueForUnit("kilometers", { distance_km: 5.0 })
    ).toBe(5.0);
  });

  it("resolves canonical aliases for minutes", () => {
    expect(
      getMetricValueForUnit("minutes", { moving_minutes: 30 })
    ).toBe(30);
  });

  it("returns undefined when no matching key exists", () => {
    expect(
      getMetricValueForUnit("miles", { calories: 500 })
    ).toBeUndefined();
  });
});
