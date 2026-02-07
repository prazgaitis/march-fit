import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Metric mapping configuration for Strava integrations
 */
export interface MetricMappingConfig {
  // Which Strava metric to use as the primary scoring metric
  primaryMetric: "distance_km" | "distance_miles" | "minutes" | "moving_minutes";
  // Optional conversion to apply (e.g., km to miles = 0.621371)
  conversionFactor?: number;
  // Target metric name in the activity (defaults to primaryMetric)
  targetMetric?: string;
}

// Available Strava metrics that can be mapped
export const STRAVA_METRICS = [
  { value: "distance_km", label: "Distance (km)", description: "Total distance in kilometers" },
  { value: "distance_miles", label: "Distance (miles)", description: "Total distance in miles" },
  { value: "minutes", label: "Duration (elapsed)", description: "Total elapsed time in minutes" },
  { value: "moving_minutes", label: "Duration (moving)", description: "Moving time in minutes" },
] as const;

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance?: number;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  kudos_count: number;
  achievement_count: number;
  athlete_count: number;
  photo_count: number;
  private: boolean;
  flagged: boolean;
}

export interface MappedActivityData {
  activityTypeId: Id<"activityTypes">;
  loggedDate: string;
  metrics: Record<string, unknown>;
  notes: string | null;
  imageUrl: string | null;
  source: "strava";
  externalId: string;
  externalData: StravaActivity;
}

const SPORT_TYPE_MAPPING: Record<string, string[]> = {
  Running: ["Run", "TrailRun", "VirtualRun"],
  Cycling: ["Ride", "VirtualRide", "EBikeRide"],
  Swimming: ["Swim"],
  "Strength Training": ["WeightTraining", "Workout"],
  Walking: ["Walk", "Hike"],
  Yoga: ["Yoga"],
};

/**
 * Maps a Strava activity to our activity format
 */
export function mapStravaActivity(
  stravaActivity: StravaActivity,
  activityTypeId: Id<"activityTypes">,
  metricMapping?: MetricMappingConfig
): MappedActivityData {
  const loggedDate = new Date(stravaActivity.start_date)
    .toISOString()
    .split("T")[0];

  const metrics = extractMetrics(stravaActivity, metricMapping);

  return {
    activityTypeId,
    loggedDate,
    metrics,
    notes: null,
    imageUrl: null,
    source: "strava",
    externalId: stravaActivity.id.toString(),
    externalData: stravaActivity,
  };
}

export interface StravaActivityTypeResult {
  activityTypeId: Id<"activityTypes">;
  metricMapping?: MetricMappingConfig;
}

/**
 * Detects the activity type ID based on Strava sport_type/type
 * Returns both the activity type ID and any configured metric mapping
 */
export async function detectStravaActivityType(
  ctx: QueryCtx | MutationCtx,
  challengeId: Id<"challenges">,
  stravaActivity: StravaActivity
): Promise<StravaActivityTypeResult | null> {
  // First check integration mappings
  const mapping = await ctx.db
    .query("integrationMappings")
    .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
    .filter((q) =>
      q.and(
        q.eq(q.field("service"), "strava"),
        q.or(
          q.eq(q.field("externalType"), stravaActivity.sport_type),
          q.eq(q.field("externalType"), stravaActivity.type)
        )
      )
    )
    .first();

  if (mapping) {
    return {
      activityTypeId: mapping.activityTypeId,
      metricMapping: mapping.metricMapping as MetricMappingConfig | undefined,
    };
  }

  // Fall back to name matching
  for (const [activityName, stravaTypes] of Object.entries(SPORT_TYPE_MAPPING)) {
    if (
      stravaTypes.includes(stravaActivity.sport_type) ||
      stravaTypes.includes(stravaActivity.type)
    ) {
      const activityTypes = await ctx.db
        .query("activityTypes")
        .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
        .collect();

      const matchingType = activityTypes.find((type) =>
        type.name.toLowerCase().includes(activityName.toLowerCase())
      );

      if (matchingType) {
        return { activityTypeId: matchingType._id };
      }
    }
  }

  return null;
}

function extractMetrics(
  stravaActivity: StravaActivity,
  metricMapping?: MetricMappingConfig
): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};

  // Always include duration in minutes (both elapsed and moving)
  metrics.minutes = Math.round(stravaActivity.elapsed_time / 60);
  metrics.moving_minutes = Math.round(stravaActivity.moving_time / 60);

  // Add distance if available (both km and miles)
  if (stravaActivity.distance) {
    metrics.distance_km = stravaActivity.distance / 1000;
    metrics.distance_miles = stravaActivity.distance / 1609.344;
  }

  // Add heart rate data if available
  if (stravaActivity.average_heartrate) {
    metrics.average_heartrate = stravaActivity.average_heartrate;
  }
  if (stravaActivity.max_heartrate) {
    metrics.max_heartrate = stravaActivity.max_heartrate;
  }

  // Add elevation if available
  if (stravaActivity.total_elevation_gain) {
    metrics.elevation_gain_m = stravaActivity.total_elevation_gain;
  }

  // Activity-specific metrics
  if (isRunningActivity(stravaActivity)) {
    addRunningMetrics(metrics, stravaActivity);
  } else if (isCyclingActivity(stravaActivity)) {
    addCyclingMetrics(metrics, stravaActivity);
  } else if (isSwimmingActivity(stravaActivity)) {
    addSwimmingMetrics(metrics, stravaActivity);
  }

  // Apply metric mapping if configured
  if (metricMapping) {
    const { primaryMetric, conversionFactor, targetMetric } = metricMapping;
    const sourceValue = metrics[primaryMetric] as number | undefined;

    if (sourceValue !== undefined) {
      const convertedValue = conversionFactor
        ? sourceValue * conversionFactor
        : sourceValue;

      // Set the target metric (defaults to the primary metric name)
      const targetKey = targetMetric || primaryMetric;
      metrics[targetKey] = convertedValue;

      // Also set common aliases for scoring compatibility
      if (targetKey === "miles" || targetKey === "distance_miles") {
        metrics.miles = convertedValue;
        metrics.distance_miles = convertedValue;
      } else if (targetKey === "kilometers" || targetKey === "distance_km") {
        metrics.kilometers = convertedValue;
        metrics.distance_km = convertedValue;
      } else if (targetKey === "minutes" || targetKey === "duration_minutes") {
        metrics.minutes = convertedValue;
        metrics.duration_minutes = convertedValue;
      }
    }
  }

  return metrics;
}

function isRunningActivity(activity: StravaActivity): boolean {
  return (
    ["Run", "TrailRun", "VirtualRun"].includes(activity.sport_type) ||
    ["Run", "TrailRun", "VirtualRun"].includes(activity.type)
  );
}

function isCyclingActivity(activity: StravaActivity): boolean {
  return (
    ["Ride", "VirtualRide", "EBikeRide"].includes(activity.sport_type) ||
    ["Ride", "VirtualRide", "EBikeRide"].includes(activity.type)
  );
}

function isSwimmingActivity(activity: StravaActivity): boolean {
  return (
    ["Swim"].includes(activity.sport_type) ||
    ["Swim"].includes(activity.type)
  );
}

function addRunningMetrics(
  metrics: Record<string, unknown>,
  activity: StravaActivity
): void {
  if (activity.distance && activity.elapsed_time) {
    metrics.average_pace_min_per_km = calculateRunningPace(
      activity.distance,
      activity.elapsed_time
    );
  }
}

function addCyclingMetrics(
  metrics: Record<string, unknown>,
  activity: StravaActivity
): void {
  if (activity.average_speed) {
    metrics.average_speed_kmh = convertSpeedToKmh(activity.average_speed);
  }
}

function addSwimmingMetrics(
  metrics: Record<string, unknown>,
  activity: StravaActivity
): void {
  if (activity.distance && activity.moving_time) {
    metrics.average_pace_min_per_100m = calculateSwimmingPace(
      activity.distance,
      activity.moving_time
    );
  }
}

function calculateRunningPace(distanceMeters: number, timeSeconds: number): string {
  const distanceKm = distanceMeters / 1000;
  const paceSecondsPerKm = timeSeconds / distanceKm;
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.round(paceSecondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function calculateSwimmingPace(distanceMeters: number, timeSeconds: number): string {
  const distance100m = distanceMeters / 100;
  const pacePer100m = timeSeconds / distance100m;
  const minutes = Math.floor(pacePer100m / 60);
  const seconds = Math.round(pacePer100m % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function convertSpeedToKmh(speedMs: number): string {
  const speedKmh = speedMs * 3.6;
  return speedKmh.toFixed(1);
}
