import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

const legacyCountThresholdCriteriaValidator = v.object({
  activityTypeIds: v.array(v.id("activityTypes")),
  metric: v.string(),
  threshold: v.number(),
  requiredCount: v.number(),
});

const countThresholdCriteriaValidator = v.object({
  type: v.literal("count_threshold"),
  activityTypeIds: v.array(v.id("activityTypes")),
  metric: v.string(),
  threshold: v.number(),
  requiredCount: v.number(),
});

const allActivityTypeThresholdsCriteriaValidator = v.object({
  type: v.literal("all_activity_type_thresholds"),
  requirements: v.array(
    v.object({
      activityTypeId: v.id("activityTypes"),
      metric: v.string(),
      threshold: v.number(),
    }),
  ),
});

export const achievementCriteriaValidator = v.union(
  legacyCountThresholdCriteriaValidator,
  countThresholdCriteriaValidator,
  allActivityTypeThresholdsCriteriaValidator,
);

export type CountThresholdCriteria = {
  type?: "count_threshold";
  activityTypeIds: Id<"activityTypes">[];
  metric: string;
  threshold: number;
  requiredCount: number;
};

export type AllActivityTypeThresholdsCriteria = {
  type: "all_activity_type_thresholds";
  requirements: Array<{
    activityTypeId: Id<"activityTypes">;
    metric: string;
    threshold: number;
  }>;
};

export type AchievementCriteria =
  | CountThresholdCriteria
  | AllActivityTypeThresholdsCriteria;

export type ActivityForAchievement = {
  _id: Id<"activities">;
  activityTypeId: Id<"activityTypes">;
  metrics?: Record<string, unknown>;
};

const ACHIEVEMENT_METRIC_KEYS: Record<string, string[]> = {
  distance_miles: ["miles", "distance_miles", "distance"],
  distance_km: ["kilometers", "km", "distance_km", "distance"],
  duration_minutes: ["minutes", "duration_minutes", "duration"],
};

function getMetricValue(metrics: Record<string, unknown>, metricName: string): number {
  const possibleKeys = ACHIEVEMENT_METRIC_KEYS[metricName] || [metricName];

  for (const key of possibleKeys) {
    const value = Number(metrics[key]);
    if (value > 0) {
      return value;
    }
  }

  return 0;
}

export function getAchievementActivityTypeIds(
  criteria: AchievementCriteria,
): Id<"activityTypes">[] {
  if (criteria.type === "all_activity_type_thresholds") {
    return Array.from(new Set(criteria.requirements.map((r) => r.activityTypeId)));
  }

  return criteria.activityTypeIds;
}

export function evaluateAchievementCriteria(
  criteria: AchievementCriteria,
  activities: ActivityForAchievement[],
): {
  qualifyingActivities: ActivityForAchievement[];
  currentCount: number;
  requiredCount: number;
} {
  if (criteria.type === "all_activity_type_thresholds") {
    const qualifyingActivities: ActivityForAchievement[] = [];

    for (const requirement of criteria.requirements) {
      const qualifying = activities.find((activity) => {
        if (activity.activityTypeId !== requirement.activityTypeId) {
          return false;
        }

        const metrics = activity.metrics ?? {};
        return getMetricValue(metrics, requirement.metric) >= requirement.threshold;
      });

      if (qualifying) {
        qualifyingActivities.push(qualifying);
      }
    }

    return {
      qualifyingActivities,
      currentCount: qualifyingActivities.length,
      requiredCount: criteria.requirements.length,
    };
  }

  const qualifyingActivities = activities.filter((activity) => {
    if (!criteria.activityTypeIds.includes(activity.activityTypeId)) {
      return false;
    }

    const metrics = activity.metrics ?? {};
    return getMetricValue(metrics, criteria.metric) >= criteria.threshold;
  });

  return {
    qualifyingActivities,
    currentCount: qualifyingActivities.length,
    requiredCount: criteria.requiredCount,
  };
}
