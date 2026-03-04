import type { Id } from "../_generated/dataModel";

/**
 * Represents a stored activity to compare against.
 */
export interface CandidateActivity {
  _id: Id<"activities">;
  activityTypeId: Id<"activityTypes">;
  loggedDate: number;
  metrics?: Record<string, unknown> | null;
  source: string;
  notes?: string | null;
  pointsEarned: number;
}

/**
 * Represents a Strava activity being checked for duplicates.
 */
export interface StravaActivityForDuplicateCheck {
  loggedDateStr: string; // "YYYY-MM-DD"
  activityTypeId: string | null;
  metrics: Record<string, unknown>;
}

export interface DuplicateMatch {
  activityId: Id<"activities">;
  reason: string;
  confidence: "high" | "medium";
}

/**
 * Tolerance thresholds for metric comparisons.
 * Values represent percentage difference allowed (0.10 = 10%).
 */
const DURATION_TOLERANCE = 0.15; // 15% tolerance for minutes
const DISTANCE_TOLERANCE = 0.15; // 15% tolerance for distance

/**
 * Check if two numeric values are "close enough" within a tolerance.
 * Returns true if the difference is within the tolerance percentage of the larger value.
 */
export function isWithinTolerance(
  a: number,
  b: number,
  tolerance: number,
): boolean {
  if (a === 0 && b === 0) return true;
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return true;
  return Math.abs(a - b) / max <= tolerance;
}

/**
 * Compare metrics between a Strava activity and a manually logged activity.
 * Returns a confidence level and description of what matched.
 */
export function compareMetrics(
  stravaMetrics: Record<string, unknown>,
  manualMetrics: Record<string, unknown>,
): { matched: boolean; reasons: string[]; confidence: "high" | "medium" } {
  const reasons: string[] = [];
  let durationMatch = false;
  let distanceMatch = false;

  // Compare duration (minutes)
  const stravaMinutes = Number(stravaMetrics.minutes ?? 0);
  const manualMinutes = Number(manualMetrics.minutes ?? 0);
  if (stravaMinutes > 0 && manualMinutes > 0) {
    if (isWithinTolerance(stravaMinutes, manualMinutes, DURATION_TOLERANCE)) {
      durationMatch = true;
      reasons.push(
        `Duration similar (${stravaMinutes} vs ${manualMinutes} min)`,
      );
    }
  }

  // Compare distance (miles)
  const stravaMiles = Number(
    stravaMetrics.distance_miles ?? stravaMetrics.miles ?? 0,
  );
  const manualMiles = Number(
    manualMetrics.distance_miles ?? manualMetrics.miles ?? 0,
  );
  if (stravaMiles > 0 && manualMiles > 0) {
    if (isWithinTolerance(stravaMiles, manualMiles, DISTANCE_TOLERANCE)) {
      distanceMatch = true;
      reasons.push(
        `Distance similar (${stravaMiles.toFixed(2)} vs ${manualMiles.toFixed(2)} mi)`,
      );
    }
  }

  // Compare distance (km) if miles didn't match
  if (!distanceMatch) {
    const stravaKm = Number(
      stravaMetrics.distance_km ?? stravaMetrics.kilometers ?? 0,
    );
    const manualKm = Number(
      manualMetrics.distance_km ?? manualMetrics.kilometers ?? 0,
    );
    if (stravaKm > 0 && manualKm > 0) {
      if (isWithinTolerance(stravaKm, manualKm, DISTANCE_TOLERANCE)) {
        distanceMatch = true;
        reasons.push(
          `Distance similar (${stravaKm.toFixed(2)} vs ${manualKm.toFixed(2)} km)`,
        );
      }
    }
  }

  // High confidence: both duration AND distance match
  if (durationMatch && distanceMatch) {
    return { matched: true, reasons, confidence: "high" };
  }

  // Medium confidence: at least one of duration or distance matches
  if (durationMatch || distanceMatch) {
    return { matched: true, reasons, confidence: "medium" };
  }

  return { matched: false, reasons: [], confidence: "medium" };
}

/**
 * Find potential duplicate manual activities for a set of Strava activities.
 *
 * For each Strava activity, checks if there are manually-logged activities
 * on the same date with the same activity type and similar metrics.
 *
 * @param stravaActivities - Strava activities to check
 * @param manualActivities - Existing manual activities to compare against
 * @param activityTypeNames - Map of activityTypeId -> name for display
 * @returns Map of Strava activity index -> duplicate match info
 */
export function findPotentialDuplicates(
  stravaActivities: StravaActivityForDuplicateCheck[],
  manualActivities: CandidateActivity[],
): Map<number, DuplicateMatch> {
  const results = new Map<number, DuplicateMatch>();

  for (let i = 0; i < stravaActivities.length; i++) {
    const strava = stravaActivities[i];
    if (!strava.activityTypeId) continue;

    // Find manual activities on the same date with the same activity type
    const candidates = manualActivities.filter((manual) => {
      if (manual.source !== "manual") return false;
      if (String(manual.activityTypeId) !== strava.activityTypeId) return false;

      // Compare dates: manual.loggedDate is UTC ms, strava.loggedDateStr is "YYYY-MM-DD"
      const manualDate = new Date(manual.loggedDate);
      const manualDateStr = `${manualDate.getUTCFullYear()}-${String(manualDate.getUTCMonth() + 1).padStart(2, "0")}-${String(manualDate.getUTCDate()).padStart(2, "0")}`;
      return manualDateStr === strava.loggedDateStr;
    });

    if (candidates.length === 0) continue;

    // Check each candidate for metric similarity
    for (const candidate of candidates) {
      const candidateMetrics = (candidate.metrics ?? {}) as Record<
        string,
        unknown
      >;
      const comparison = compareMetrics(strava.metrics, candidateMetrics);

      if (comparison.matched) {
        results.set(i, {
          activityId: candidate._id,
          reason: comparison.reasons.join("; "),
          confidence: comparison.confidence,
        });
        break; // Take the first match
      }
    }
  }

  return results;
}
