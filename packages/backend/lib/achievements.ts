/**
 * Shared helpers for achievement criteria evaluation.
 * Used by both queries (for progress display) and mutations (for awarding).
 */
import type { Id } from "../_generated/dataModel";
import { notDeleted } from "./activityFilters";

// Map achievement metric names to possible keys in activity.metrics
export const ACHIEVEMENT_METRIC_KEYS: Record<string, string[]> = {
  distance_miles: ["miles", "distance_miles", "distance"],
  distance_km: ["kilometers", "km", "distance_km", "distance"],
  duration_minutes: ["minutes", "duration_minutes", "duration"],
};

// Cross-unit fallbacks: if the requested metric isn't found, try the
// complementary unit and convert.  E.g. an activity that only stores
// "kilometers" can still satisfy a "distance_miles" requirement.
const UNIT_FALLBACKS: Record<string, { altMetric: string; factor: number }> = {
  distance_miles: { altMetric: "distance_km", factor: 1 / 1.609344 },
  distance_km: { altMetric: "distance_miles", factor: 1.609344 },
};

/**
 * Get the metric value from activity metrics using various possible keys.
 */
export function getMetricValue(
  metrics: Record<string, unknown>,
  metricName: string
): number {
  const possibleKeys = ACHIEVEMENT_METRIC_KEYS[metricName] ?? [metricName];
  for (const key of possibleKeys) {
    const value = Number(metrics[key]);
    if (value > 0) return value;
  }
  return 0;
}

/**
 * Like getMetricValue but falls back to cross-unit conversion when the
 * direct lookup returns 0 (e.g. activity stores km, requirement is miles).
 */
export function getMetricValueWithConversion(
  metrics: Record<string, unknown>,
  metricName: string
): number {
  const direct = getMetricValue(metrics, metricName);
  if (direct > 0) return direct;

  const fallback = UNIT_FALLBACKS[metricName];
  if (fallback) {
    const altValue = getMetricValue(metrics, fallback.altMetric);
    if (altValue > 0) return altValue * fallback.factor;
  }

  return 0;
}

/**
 * Compute progress numbers for any criteria type.
 * Returns currentCount, requiredCount, and qualifying activity IDs.
 */
export function computeCriteriaProgress(
  activities: any[],
  criteria: any
): {
  currentCount: number;
  requiredCount: number;
  qualifyingActivityIds: any[];
} {
  const criteriaType: string = criteria.criteriaType ?? "count";
  const matchingActivities =
    criteriaType === "all_activity_type_thresholds" || criteriaType === "n_of_thresholds"
      ? activities
      : activities.filter((a: any) =>
          criteria.activityTypeIds.includes(a.activityTypeId)
        );

  switch (criteriaType) {
    case "count": {
      const qualifying = matchingActivities.filter((a: any) => {
        const metrics = (a.metrics ?? {}) as Record<string, unknown>;
        return getMetricValue(metrics, criteria.metric) >= criteria.threshold;
      });
      return {
        currentCount: qualifying.length,
        requiredCount: criteria.requiredCount,
        qualifyingActivityIds: qualifying.map((a: any) => a._id),
      };
    }

    case "cumulative": {
      let total = 0;
      const ids: any[] = [];
      for (const activity of matchingActivities) {
        const metrics = (activity.metrics ?? {}) as Record<string, unknown>;
        const conversionFactor: number =
          criteria.unitConversions?.[activity.activityTypeId] ?? 1;

        let value = getMetricValue(metrics, criteria.metric);

        // When a conversion factor is provided the activity stores values in
        // a different unit than the threshold (e.g. Rowing stores km but the
        // threshold is in miles).  If the direct lookup returns 0, try the
        // complementary distance metric so the raw source value is found.
        if (value === 0 && conversionFactor !== 1) {
          const alt =
            criteria.metric === "distance_miles"
              ? "distance_km"
              : criteria.metric === "distance_km"
              ? "distance_miles"
              : criteria.metric;
          value = getMetricValue(metrics, alt);
        }

        value *= conversionFactor;
        if (value > 0) {
          total += value;
          ids.push(activity._id);
        }
      }
      return {
        currentCount: Math.round(total * 100) / 100,
        requiredCount: criteria.threshold,
        qualifyingActivityIds: ids,
      };
    }

    case "distinct_types": {
      // One representative activity per distinct type
      const seenTypes = new Set<string>();
      const ids: any[] = [];
      for (const activity of matchingActivities) {
        if (!seenTypes.has(activity.activityTypeId)) {
          seenTypes.add(activity.activityTypeId);
          ids.push(activity._id);
        }
      }
      return {
        currentCount: seenTypes.size,
        requiredCount: criteria.requiredCount,
        qualifyingActivityIds: ids,
      };
    }

    case "one_of_each": {
      const seenTypes = new Set<string>();
      const ids: any[] = [];
      for (const activity of matchingActivities) {
        if (!seenTypes.has(activity.activityTypeId)) {
          seenTypes.add(activity.activityTypeId);
          ids.push(activity._id);
        }
      }
      const completedCount = criteria.activityTypeIds.filter((id: string) =>
        seenTypes.has(id)
      ).length;
      return {
        currentCount: completedCount,
        requiredCount: criteria.activityTypeIds.length,
        qualifyingActivityIds: ids,
      };
    }

    case "all_activity_type_thresholds":
    case "n_of_thresholds": {
      const qualifyingByType = new Map<string, any>();

      for (const requirement of criteria.requirements ?? []) {
        const found = matchingActivities.find((a: any) => {
          if (a.activityTypeId !== requirement.activityTypeId) return false;
          const metrics = (a.metrics ?? {}) as Record<string, unknown>;
          return getMetricValueWithConversion(metrics, requirement.metric) >= requirement.threshold;
        });

        if (found) {
          qualifyingByType.set(requirement.activityTypeId, found._id);
        }
      }

      const required =
        criteriaType === "n_of_thresholds"
          ? criteria.requiredCount
          : (criteria.requirements ?? []).length;

      return {
        currentCount: qualifyingByType.size,
        requiredCount: required,
        qualifyingActivityIds: Array.from(qualifyingByType.values()),
      };
    }

    default:
      return { currentCount: 0, requiredCount: 0, qualifyingActivityIds: [] };
  }
}

/** Get criteria activity type IDs regardless of criteria variant. */
export function getCriteriaActivityTypeIds(criteria: any): Id<"activityTypes">[] {
  const criteriaType: string = criteria.criteriaType ?? "count";
  if (criteriaType === "all_activity_type_thresholds" || criteriaType === "n_of_thresholds") {
    return Array.from(
      new Set((criteria.requirements ?? []).map((r: any) => r.activityTypeId))
    ) as Id<"activityTypes">[];
  }
  return (criteria.activityTypeIds ?? []) as Id<"activityTypes">[];
}

/**
 * Fetch user's non-deleted activities for a challenge, filtered to matching types.
 */
export async function fetchMatchingActivities(
  ctx: any,
  userId: any,
  challengeId: any,
  activityTypeIds: any[]
): Promise<any[]> {
  const all = await ctx.db
    .query("activities")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .filter((q: any) =>
      q.and(q.eq(q.field("challengeId"), challengeId), notDeleted(q))
    )
    .collect();

  return all.filter((a: any) => activityTypeIds.includes(a.activityTypeId));
}
