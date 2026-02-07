"use node";

import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh Strava access token if expired or expiring soon
 */
export const refreshToken = action({
  args: {
    integrationId: v.id("userIntegrations"),
    currentExpiresAt: v.number(),
    refreshToken: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const now = Math.floor(Date.now() / 1000);
    const oneHourFromNow = now + 3600;

    // If token is still valid for more than an hour, no need to refresh
    if (args.currentExpiresAt > oneHourFromNow) {
      // Return empty string to indicate no refresh was needed
      // Caller should use existing token
      return "";
    }

    console.log("Refreshing Strava token for integration:", args.integrationId);

    const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: args.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to refresh Strava token:", errorText);
      throw new Error("Failed to refresh Strava token");
    }

    const data = (await response.json()) as StravaTokenResponse;

    // Update the stored tokens
    await ctx.runMutation(internal.mutations.integrations.updateStravaTokens, {
      integrationId: args.integrationId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    });

    return data.access_token;
  },
});

/**
 * Fetch activity details from Strava API
 */
export const fetchActivity = action({
  args: {
    accessToken: v.string(),
    activityId: v.number(),
  },
  handler: async (ctx, args) => {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${args.activityId}`,
      {
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch Strava activity:", errorText);
      throw new Error("Failed to fetch activity from Strava");
    }

    return await response.json();
  },
});

/**
 * Fetch recent activities from Strava API
 */
export const fetchRecentActivities = action({
  args: {
    accessToken: v.string(),
    perPage: v.optional(v.number()),
    page: v.optional(v.number()),
    after: v.optional(v.number()), // Unix timestamp
    before: v.optional(v.number()), // Unix timestamp
  },
  handler: async (ctx, args) => {
    const params = new URLSearchParams();
    params.set("per_page", String(args.perPage ?? 30));
    params.set("page", String(args.page ?? 1));

    if (args.after) {
      params.set("after", String(args.after));
    }
    if (args.before) {
      params.set("before", String(args.before));
    }

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch Strava activities:", errorText);
      throw new Error("Failed to fetch activities from Strava");
    }

    return await response.json();
  },
});

interface StravaActivity {
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
}

interface ScoringPreview {
  activityTypeId: string | null;
  activityTypeName: string | null;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  triggeredBonuses: Array<{
    description: string;
    bonusPoints: number;
  }>;
  metrics: Record<string, unknown>;
  mappingSource: "explicit" | "fallback" | "none";
}

/**
 * Fetch recent Strava activities and preview how they would be scored
 * This handles token refresh and scoring calculation
 */
export const fetchActivitiesWithScoringPreview = action({
  args: {
    integrationId: v.id("userIntegrations"),
    challengeId: v.id("challenges"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    perPage: v.optional(v.number()),
    after: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    activities: Array<{
      stravaActivity: StravaActivity;
      scoring: ScoringPreview;
    }>;
    tokenRefreshed: boolean;
  }> => {
    // Refresh token if needed
    let accessToken = args.accessToken;
    let tokenRefreshed = false;

    const now = Math.floor(Date.now() / 1000);
    const oneHourFromNow = now + 3600;

    if (args.expiresAt <= oneHourFromNow) {
      console.log("Token expired or expiring soon, refreshing...");
      const newToken = await ctx.runAction(api.actions.strava.refreshToken, {
        integrationId: args.integrationId,
        currentExpiresAt: args.expiresAt,
        refreshToken: args.refreshToken,
      });

      if (newToken) {
        accessToken = newToken;
        tokenRefreshed = true;
      }
    }

    // Fetch activities from Strava
    const stravaActivities = await ctx.runAction(api.actions.strava.fetchRecentActivities, {
      accessToken,
      perPage: args.perPage ?? 20,
      after: args.after,
    }) as StravaActivity[];

    // Get challenge activity types and integration mappings for scoring preview
    const scoringData = await ctx.runQuery(internal.queries.admin.getScoringPreviewData, {
      challengeId: args.challengeId,
    });

    const results = stravaActivities.map((stravaActivity: StravaActivity) => {
      const scoring = calculateScoringPreview(stravaActivity, scoringData);
      return {
        stravaActivity,
        scoring,
      };
    });

    return {
      activities: results,
      tokenRefreshed,
    };
  },
});

interface ScoringData {
  activityTypes: Array<{
    _id: string;
    name: string;
    scoringConfig: Record<string, unknown>;
    bonusThresholds?: Array<{
      metric: string;
      threshold: number;
      bonusPoints: number;
      description: string;
    }>;
  }>;
  integrationMappings: Array<{
    externalType: string;
    activityTypeId: string;
    metricMapping?: {
      primaryMetric: string;
      conversionFactor?: number;
      targetMetric?: string;
    };
  }>;
}

const SPORT_TYPE_MAPPING: Record<string, string[]> = {
  "Outdoor Run": ["Run", "TrailRun", "VirtualRun"],
  Running: ["Run", "TrailRun", "VirtualRun"],
  "Outdoor Cycling": ["Ride", "VirtualRide", "EBikeRide"],
  Cycling: ["Ride", "VirtualRide", "EBikeRide"],
  Swimming: ["Swim"],
  "Strength Training": ["WeightTraining", "Workout"],
  Walking: ["Walk", "Hike"],
  Yoga: ["Yoga"],
  "Hi-Intensity Cardio": ["CrossFit", "Elliptical", "Workout"],
  "Lo-Intensity Cardio": ["Elliptical", "Walk", "Hike", "Golf"],
  Rowing: ["Rowing"],
};

function calculateScoringPreview(
  stravaActivity: StravaActivity,
  scoringData: ScoringData
): ScoringPreview {
  // Extract metrics from Strava activity
  const metrics: Record<string, unknown> = {};

  metrics.minutes = Math.round(stravaActivity.elapsed_time / 60);
  metrics.moving_minutes = Math.round(stravaActivity.moving_time / 60);
  metrics.duration_minutes = metrics.minutes;

  if (stravaActivity.distance) {
    metrics.distance_km = stravaActivity.distance / 1000;
    metrics.distance_miles = stravaActivity.distance / 1609.344;
    metrics.kilometers = metrics.distance_km;
    metrics.miles = metrics.distance_miles;
  }

  // Find matching activity type
  let matchedActivityType: ScoringData["activityTypes"][0] | null = null;
  let metricMapping: ScoringData["integrationMappings"][0]["metricMapping"] | undefined;
  let mappingSource: "explicit" | "fallback" | "none" = "none";

  // First, check explicit integration mappings
  const explicitMapping = scoringData.integrationMappings.find(
    (m) =>
      m.externalType === stravaActivity.sport_type ||
      m.externalType === stravaActivity.type
  );

  if (explicitMapping) {
    matchedActivityType =
      scoringData.activityTypes.find((t) => t._id === explicitMapping.activityTypeId) || null;
    metricMapping = explicitMapping.metricMapping;
    mappingSource = "explicit";
  }

  // Fall back to name matching
  if (!matchedActivityType) {
    for (const [activityName, stravaTypes] of Object.entries(SPORT_TYPE_MAPPING)) {
      if (
        stravaTypes.includes(stravaActivity.sport_type) ||
        stravaTypes.includes(stravaActivity.type)
      ) {
        matchedActivityType =
          scoringData.activityTypes.find((t) =>
            t.name.toLowerCase().includes(activityName.toLowerCase())
          ) || null;

        if (matchedActivityType) {
          mappingSource = "fallback";
          break;
        }
      }
    }
  }

  if (!matchedActivityType) {
    return {
      activityTypeId: null,
      activityTypeName: null,
      basePoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      triggeredBonuses: [],
      metrics,
      mappingSource: "none",
    };
  }

  // Apply metric mapping if configured
  if (metricMapping) {
    const { primaryMetric, conversionFactor, targetMetric } = metricMapping;
    const sourceValue = metrics[primaryMetric] as number | undefined;

    if (sourceValue !== undefined) {
      const convertedValue = conversionFactor
        ? sourceValue * conversionFactor
        : sourceValue;

      const targetKey = targetMetric || primaryMetric;
      metrics[targetKey] = convertedValue;
    }
  }

  // Calculate base points
  const config = matchedActivityType.scoringConfig;
  let basePoints = 0;

  const scoringType = config["type"] as string | undefined;

  if (scoringType === "tiered") {
    const tieredMetric = config["metric"] as string | undefined;
    const tiers = config["tiers"] as Array<{ maxValue?: number; points: number }> | undefined;
    const metricValue = metrics[tieredMetric || ""] as number | undefined;

    if (tiers && metricValue !== undefined) {
      for (const tier of tiers) {
        if (tier.maxValue === undefined || metricValue <= tier.maxValue) {
          basePoints = tier.points;
          break;
        }
      }
      if (basePoints === 0 && tiers.length > 0) {
        basePoints = tiers[tiers.length - 1].points;
      }
    }
  } else if (scoringType === "completion") {
    basePoints = (config["fixedPoints"] as number) || (config["points"] as number) || 0;
  } else {
    // Unit-based scoring
    const unit = config["unit"] as string | undefined;
    const pointsPerUnit = (config["pointsPerUnit"] as number) || 0;
    const baseConfigPoints = (config["basePoints"] as number) || 0;
    const maxUnits = config["maxUnits"] as number | undefined;

    if (unit && metrics[unit] !== undefined) {
      let unitValue = metrics[unit] as number;
      if (maxUnits !== undefined && unitValue > maxUnits) {
        unitValue = maxUnits;
      }
      basePoints = baseConfigPoints + unitValue * pointsPerUnit;
    } else {
      basePoints = baseConfigPoints;
    }
  }

  // Calculate threshold bonuses
  const triggeredBonuses: ScoringPreview["triggeredBonuses"] = [];
  let bonusPoints = 0;

  if (matchedActivityType.bonusThresholds) {
    for (const threshold of matchedActivityType.bonusThresholds) {
      // Map threshold metric to actual metric value
      const metricValue = getMetricValueForThreshold(threshold.metric, metrics);

      if (metricValue !== undefined && metricValue >= threshold.threshold) {
        triggeredBonuses.push({
          description: threshold.description,
          bonusPoints: threshold.bonusPoints,
        });
        bonusPoints += threshold.bonusPoints;
      }
    }
  }

  return {
    activityTypeId: matchedActivityType._id,
    activityTypeName: matchedActivityType.name,
    basePoints: Math.round(basePoints * 100) / 100,
    bonusPoints,
    totalPoints: Math.round((basePoints + bonusPoints) * 100) / 100,
    triggeredBonuses,
    metrics,
    mappingSource,
  };
}

function getMetricValueForThreshold(
  thresholdMetric: string,
  metrics: Record<string, unknown>
): number | undefined {
  // Map threshold metrics to activity metrics
  const metricMapping: Record<string, string[]> = {
    distance_miles: ["miles", "distance_miles"],
    distance_km: ["kilometers", "distance_km", "km"],
    duration_minutes: ["minutes", "duration_minutes"],
  };

  const possibleKeys = metricMapping[thresholdMetric] || [thresholdMetric];

  for (const key of possibleKeys) {
    if (metrics[key] !== undefined) {
      return metrics[key] as number;
    }
  }

  return undefined;
}
