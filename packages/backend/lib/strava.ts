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
  start_date_local?: string;
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
  // Location data from detailed activity response
  start_latlng?: [number, number] | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  timezone?: string; // e.g., "(GMT-06:00) America/Chicago"
  // Photos from detailed activity response
  photos?: {
    primary?: {
      urls?: Record<string, string>; // e.g. { "100": "url", "600": "url" }
    };
    count?: number;
  };
}

export interface MappedActivityData {
  activityTypeId: Id<"activityTypes">;
  loggedDate: string;
  localTime: string | null; // "HH:MM" from start_date_local
  timezone: string | null; // IANA timezone extracted from Strava's timezone field
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  startLatlng: [number, number] | null;
  metrics: Record<string, unknown>;
  notes: string | null;
  imageUrl: string | null;
  stravaPhotoUrls: string[]; // All photo URLs extracted from Strava
  source: "strava";
  externalId: string;
  externalData: Record<string, unknown>;
}

// Maps activity type name keywords → Strava sport_type/type values.
// Multiple keys can map to the same Strava types to handle different naming
// conventions (e.g. "Running" vs "Outdoor Run" vs "Run").
const SPORT_TYPE_MAPPING: Record<string, string[]> = {
  Run: ["Run", "TrailRun", "VirtualRun"],
  Running: ["Run", "TrailRun", "VirtualRun"],
  Cycling: ["Ride", "VirtualRide", "EBikeRide"],
  Swimming: ["Swim"],
  "Strength Training": ["WeightTraining", "Workout"],
  Walking: ["Walk", "Hike"],
  Yoga: ["Yoga"],
  Rowing: ["Rowing"],
  "Hi-Intensity Cardio": ["CrossFit", "Elliptical", "Workout"],
  "Lo-Intensity Cardio": ["Elliptical", "Walk", "Hike", "Golf", "WeightTraining"],
};

/**
 * Maps a Strava activity to our activity format
 */
/**
 * Extract photo URLs from a Strava activity's photos field.
 * Returns the largest available URL for the primary photo, and all available URLs.
 */
function extractStravaPhotos(stravaActivity: StravaActivity): {
  primaryUrl: string | null;
  allUrls: string[];
} {
  const photos = stravaActivity.photos;
  if (!photos || (!photos.count && !photos.primary)) {
    return { primaryUrl: null, allUrls: [] };
  }

  const primaryUrls = photos.primary?.urls;
  if (!primaryUrls) {
    return { primaryUrl: null, allUrls: [] };
  }

  // Get the largest resolution URL (highest numeric key)
  const sortedKeys = Object.keys(primaryUrls).sort(
    (a, b) => Number(b) - Number(a)
  );
  const primaryUrl = sortedKeys.length > 0 ? primaryUrls[sortedKeys[0]] : null;
  const allUrls = primaryUrl ? [primaryUrl] : [];

  return { primaryUrl, allUrls };
}

/**
 * Extract IANA timezone from Strava's timezone field.
 * Strava returns e.g. "(GMT-06:00) America/Chicago" — we extract "America/Chicago".
 */
function extractStravaTimezone(stravaTz?: string): string | null {
  if (!stravaTz) return null;
  const match = stravaTz.match(/\)\s*(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extract local time "HH:MM" from Strava's start_date_local ISO string.
 */
function extractLocalTime(startDateLocal?: string): string | null {
  if (!startDateLocal) return null;
  const match = startDateLocal.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/**
 * Strip large fields from a Strava API response before storing as externalData.
 * Uses a whitelist so any new large fields Strava adds won't bloat storage.
 * Reduces per-activity storage from 50-200KB to ~1-2KB.
 */
const STRAVA_KEEP_FIELDS = [
  "id", "name", "type", "sport_type", "workout_type",
  "start_date", "start_date_local", "timezone",
  "elapsed_time", "moving_time",
  "distance",
  "average_speed", "max_speed",
  "average_heartrate", "max_heartrate",
  "total_elevation_gain",
  "kudos_count", "achievement_count", "athlete_count",
  "photo_count", "total_photo_count",
  "photos",
  "private", "flagged",
  "trainer", "commute",
] as const;

function sanitizeStravaExternalData(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of STRAVA_KEEP_FIELDS) {
    if (key in raw) {
      sanitized[key] = raw[key];
    }
  }
  return sanitized;
}

export function mapStravaActivity(
  stravaActivity: StravaActivity,
  activityTypeId: Id<"activityTypes">,
  metricMapping?: MetricMappingConfig
): MappedActivityData {
  // Use the activity's local date when available to get the correct calendar day
  const loggedDate = (stravaActivity.start_date_local ?? stravaActivity.start_date).split("T")[0];

  const metrics = extractMetrics(stravaActivity, metricMapping);

  // Extract photo URLs from Strava activity
  const { primaryUrl, allUrls } = extractStravaPhotos(stravaActivity);

  // Extract location & time context
  const localTime = extractLocalTime(stravaActivity.start_date_local);
  const timezone = extractStravaTimezone(stravaActivity.timezone);
  const startLatlng = stravaActivity.start_latlng && stravaActivity.start_latlng.length === 2
    ? stravaActivity.start_latlng
    : null;

  return {
    activityTypeId,
    loggedDate,
    localTime,
    timezone,
    locationCity: stravaActivity.location_city ?? null,
    locationState: stravaActivity.location_state ?? null,
    locationCountry: stravaActivity.location_country ?? null,
    startLatlng,
    metrics,
    notes: stravaActivity.name,
    imageUrl: primaryUrl,
    stravaPhotoUrls: allUrls,
    source: "strava",
    externalId: stravaActivity.id.toString(),
    externalData: sanitizeStravaExternalData(
      stravaActivity as unknown as Record<string, unknown>,
    ),
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

      const keyLower = activityName.toLowerCase();
      const matchingType = activityTypes.find((type) => {
        const nameLower = type.name.toLowerCase();
        // Bidirectional: "outdoor run" includes "run", OR "running" includes "run"
        return nameLower.includes(keyLower) || keyLower.includes(nameLower);
      });

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

  // Add distance if available (both km and miles, plus canonical scoring keys)
  if (stravaActivity.distance) {
    const km = stravaActivity.distance / 1000;
    const miles = stravaActivity.distance / 1609.344;
    metrics.distance_km = km;
    metrics.distance_miles = miles;
    // Canonical keys for scoring compatibility (scoring configs use "miles"/"kilometers")
    metrics.miles = miles;
    metrics.kilometers = km;
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
