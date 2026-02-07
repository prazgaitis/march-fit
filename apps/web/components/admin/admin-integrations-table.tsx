"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  ArrowRight,
  CheckCircle,
  Loader2,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Sample Strava activity data for each type
const STRAVA_ACTIVITY_SAMPLES: Record<string, {
  type: string;
  description: string;
  sample: {
    distance?: number; // meters
    elapsed_time: number; // seconds
    moving_time: number; // seconds
    total_elevation_gain?: number;
    average_heartrate?: number;
  };
}> = {
  Run: {
    type: "Run",
    description: "Running, jogging",
    sample: { distance: 5000, elapsed_time: 1800, moving_time: 1750, average_heartrate: 155 },
  },
  Ride: {
    type: "Ride",
    description: "Cycling, biking",
    sample: { distance: 25000, elapsed_time: 3600, moving_time: 3400, total_elevation_gain: 350 },
  },
  Swim: {
    type: "Swim",
    description: "Swimming",
    sample: { distance: 1500, elapsed_time: 2400, moving_time: 2200 },
  },
  Walk: {
    type: "Walk",
    description: "Walking, hiking",
    sample: { distance: 3000, elapsed_time: 2400, moving_time: 2300 },
  },
  Hike: {
    type: "Hike",
    description: "Hiking, trekking",
    sample: { distance: 8000, elapsed_time: 10800, moving_time: 9600, total_elevation_gain: 500 },
  },
  WeightTraining: {
    type: "WeightTraining",
    description: "Weight lifting, gym",
    sample: { elapsed_time: 3600, moving_time: 3000, average_heartrate: 120 },
  },
  Workout: {
    type: "Workout",
    description: "General workout",
    sample: { elapsed_time: 2700, moving_time: 2400, average_heartrate: 140 },
  },
  Yoga: {
    type: "Yoga",
    description: "Yoga, stretching",
    sample: { elapsed_time: 3600, moving_time: 3600, average_heartrate: 85 },
  },
  Crossfit: {
    type: "Crossfit",
    description: "Crossfit training",
    sample: { elapsed_time: 3600, moving_time: 3200, average_heartrate: 155 },
  },
  Elliptical: {
    type: "Elliptical",
    description: "Elliptical machine",
    sample: { distance: 5000, elapsed_time: 1800, moving_time: 1800, average_heartrate: 135 },
  },
  StairStepper: {
    type: "StairStepper",
    description: "Stair climbing",
    sample: { elapsed_time: 1800, moving_time: 1800, average_heartrate: 145 },
  },
  Rowing: {
    type: "Rowing",
    description: "Rowing machine or boat",
    sample: { distance: 5000, elapsed_time: 1500, moving_time: 1500, average_heartrate: 150 },
  },
  AlpineSki: {
    type: "AlpineSki",
    description: "Downhill skiing",
    sample: { distance: 15000, elapsed_time: 14400, moving_time: 7200, total_elevation_gain: 100 },
  },
  NordicSki: {
    type: "NordicSki",
    description: "Cross-country skiing",
    sample: { distance: 10000, elapsed_time: 3600, moving_time: 3400, total_elevation_gain: 200 },
  },
  Snowboard: {
    type: "Snowboard",
    description: "Snowboarding",
    sample: { distance: 12000, elapsed_time: 14400, moving_time: 6000, total_elevation_gain: 50 },
  },
  IceSkate: {
    type: "IceSkate",
    description: "Ice skating",
    sample: { distance: 5000, elapsed_time: 3600, moving_time: 3400 },
  },
  RockClimbing: {
    type: "RockClimbing",
    description: "Rock climbing",
    sample: { elapsed_time: 7200, moving_time: 5400, total_elevation_gain: 150 },
  },
  Golf: {
    type: "Golf",
    description: "Golf",
    sample: { distance: 8000, elapsed_time: 14400, moving_time: 10800 },
  },
  Soccer: {
    type: "Soccer",
    description: "Soccer, football",
    sample: { distance: 8000, elapsed_time: 5400, moving_time: 5000, average_heartrate: 145 },
  },
  Tennis: {
    type: "Tennis",
    description: "Tennis, racquet sports",
    sample: { elapsed_time: 3600, moving_time: 2700, average_heartrate: 130 },
  },
  Basketball: {
    type: "Basketball",
    description: "Basketball",
    sample: { elapsed_time: 3600, moving_time: 3000, average_heartrate: 140 },
  },
  VirtualRide: {
    type: "VirtualRide",
    description: "Indoor cycling (Zwift, etc.)",
    sample: { distance: 30000, elapsed_time: 3600, moving_time: 3600, average_heartrate: 145 },
  },
  VirtualRun: {
    type: "VirtualRun",
    description: "Treadmill running",
    sample: { distance: 8000, elapsed_time: 2700, moving_time: 2700, average_heartrate: 160 },
  },
};

// Available Strava metrics for scoring
const STRAVA_METRICS = [
  { value: "distance_km", label: "Distance (km)" },
  { value: "distance_miles", label: "Distance (miles)" },
  { value: "minutes", label: "Duration (elapsed)" },
  { value: "moving_minutes", label: "Duration (moving)" },
];

interface MetricMappingConfig {
  primaryMetric: string;
  conversionFactor?: number;
  targetMetric?: string;
}

interface ActivityType {
  _id: Id<"activityTypes">;
  name: string;
  scoringConfig?: Record<string, unknown>;
}

interface IntegrationMapping {
  _id: Id<"integrationMappings">;
  service: "strava" | "apple_health";
  externalType: string;
  activityTypeId: Id<"activityTypes">;
  activityTypeName: string;
  metricMapping?: MetricMappingConfig;
}

interface AdminIntegrationsTableProps {
  challengeId: string;
  activityTypes: ActivityType[];
}

interface PendingChange {
  activityTypeId: Id<"activityTypes"> | null;
  metricMapping?: MetricMappingConfig;
}

// Calculate sample points based on activity type scoring config
function calculateSamplePoints(
  sample: typeof STRAVA_ACTIVITY_SAMPLES[string]["sample"],
  activityType: ActivityType | null,
  metricMapping?: MetricMappingConfig
): { points: number; breakdown: string; metricUsed: string; metricValue: number } | null {
  if (!activityType?.scoringConfig) return null;

  const config = activityType.scoringConfig;
  const basePoints = Number(config.basePoints ?? config.points ?? 0);
  const unit = config.unit as string | undefined;
  const pointsPerUnit = Number(config.pointsPerUnit ?? 1);

  // Calculate available metrics from sample
  const metrics: Record<string, number> = {
    minutes: Math.round(sample.elapsed_time / 60),
    moving_minutes: Math.round(sample.moving_time / 60),
  };
  if (sample.distance) {
    metrics.distance_km = sample.distance / 1000;
    metrics.distance_miles = sample.distance / 1609.344;
  }

  // If no unit-based scoring, just return base points
  if (!unit) {
    return { points: basePoints, breakdown: `${basePoints} base points`, metricUsed: "flat", metricValue: 1 };
  }

  // Determine which metric to use
  let metricValue: number | undefined;
  let usedMetric: string;

  if (metricMapping?.primaryMetric) {
    metricValue = metrics[metricMapping.primaryMetric];
    usedMetric = metricMapping.primaryMetric;
  } else {
    // Try to find a matching metric
    metricValue = metrics[unit];
    usedMetric = unit;
    if (metricValue === undefined) {
      // Try common aliases
      if (unit === "miles" || unit === "distance") {
        metricValue = metrics.distance_miles;
        usedMetric = "distance_miles";
      } else if (unit === "kilometers" || unit === "km") {
        metricValue = metrics.distance_km;
        usedMetric = "distance_km";
      } else if (unit === "duration" || unit === "time") {
        metricValue = metrics.minutes;
        usedMetric = "minutes";
      }
    }
  }

  if (metricValue === undefined) {
    return { points: basePoints, breakdown: `${basePoints} base (no ${unit} data)`, metricUsed: unit, metricValue: 0 };
  }

  const unitPoints = metricValue * pointsPerUnit;
  const total = basePoints + unitPoints;

  return {
    points: Math.round(total * 10) / 10,
    breakdown: `${basePoints} + (${metricValue.toFixed(1)} × ${pointsPerUnit})`,
    metricUsed: usedMetric,
    metricValue,
  };
}

export function AdminIntegrationsTable({
  challengeId,
  activityTypes,
}: AdminIntegrationsTableProps) {
  // Use reactive query for mappings so UI updates after save
  const existingMappings = useQuery(api.queries.integrationMappings.listByChallenge, {
    challengeId: challengeId as Id<"challenges">,
    service: "strava",
  }) ?? [];

  const upsertMapping = useMutation(api.mutations.integrationMappings.upsert);
  const removeMapping = useMutation(api.mutations.integrationMappings.remove);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [savingTypes, setSavingTypes] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const clearStatus = () => setTimeout(() => setStatusMessage(null), 3000);

  const getExistingMapping = (stravaType: string): IntegrationMapping | undefined => {
    return existingMappings.find(
      (m: IntegrationMapping) => m.service === "strava" && m.externalType === stravaType
    );
  };

  const getPendingOrExisting = (stravaType: string): PendingChange | null => {
    if (stravaType in pendingChanges) {
      return pendingChanges[stravaType];
    }
    const existing = getExistingMapping(stravaType);
    if (existing) {
      return {
        activityTypeId: existing.activityTypeId,
        metricMapping: existing.metricMapping,
      };
    }
    return null;
  };

  const getActivityType = (id: Id<"activityTypes"> | null) => {
    if (!id) return null;
    return activityTypes.find((at) => at._id === id) ?? null;
  };

  const handleActivityTypeChange = (stravaType: string, activityTypeId: string) => {
    const value = activityTypeId === "" ? null : (activityTypeId as Id<"activityTypes">);
    const current = getPendingOrExisting(stravaType);
    setPendingChanges((prev) => ({
      ...prev,
      [stravaType]: {
        activityTypeId: value,
        metricMapping: value ? current?.metricMapping : undefined,
      },
    }));
  };

  const handleMetricChange = (stravaType: string, metric: string) => {
    const current = getPendingOrExisting(stravaType);
    if (!current?.activityTypeId) return;

    setPendingChanges((prev) => ({
      ...prev,
      [stravaType]: {
        ...current,
        metricMapping: metric
          ? { primaryMetric: metric }
          : undefined,
      },
    }));
  };

  const handleSave = async (stravaType: string) => {
    const pending = getPendingOrExisting(stravaType);
    const existing = getExistingMapping(stravaType);

    setSavingTypes((prev) => new Set(prev).add(stravaType));

    try {
      if (pending?.activityTypeId === null && existing) {
        await removeMapping({ mappingId: existing._id });
        setStatusMessage({ type: "success", text: `Removed mapping for ${stravaType}` });
      } else if (pending?.activityTypeId) {
        await upsertMapping({
          challengeId: challengeId as Id<"challenges">,
          service: "strava",
          externalType: stravaType,
          activityTypeId: pending.activityTypeId,
          metricMapping: pending.metricMapping,
        });
        setStatusMessage({ type: "success", text: `Saved mapping for ${stravaType}` });
      }
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[stravaType];
        return next;
      });
      clearStatus();
    } catch (error) {
      setStatusMessage({ type: "error", text: `Failed to save: ${error}` });
    } finally {
      setSavingTypes((prev) => {
        const next = new Set(prev);
        next.delete(stravaType);
        return next;
      });
    }
  };

  const handleRemove = async (stravaType: string) => {
    const existing = getExistingMapping(stravaType);
    if (!existing) return;

    setSavingTypes((prev) => new Set(prev).add(stravaType));

    try {
      await removeMapping({ mappingId: existing._id });
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[stravaType];
        return next;
      });
      setStatusMessage({ type: "success", text: `Removed mapping for ${stravaType}` });
      clearStatus();
    } catch (error) {
      setStatusMessage({ type: "error", text: `Failed to remove: ${error}` });
    } finally {
      setSavingTypes((prev) => {
        const next = new Set(prev);
        next.delete(stravaType);
        return next;
      });
    }
  };

  const hasPendingChange = (stravaType: string): boolean => {
    if (!(stravaType in pendingChanges)) return false;
    const pending = pendingChanges[stravaType];
    const existing = getExistingMapping(stravaType);

    if (!existing) {
      return pending.activityTypeId !== null;
    }

    if (pending.activityTypeId !== existing.activityTypeId) return true;
    if (JSON.stringify(pending.metricMapping) !== JSON.stringify(existing.metricMapping)) return true;

    return false;
  };

  const mappedCount = existingMappings.filter((m: IntegrationMapping) => m.service === "strava").length;
  const stravaTypes = Object.values(STRAVA_ACTIVITY_SAMPLES);

  // Get data for selected type
  const selectedData = selectedType ? STRAVA_ACTIVITY_SAMPLES[selectedType] : null;
  const selectedPending = selectedType ? getPendingOrExisting(selectedType) : null;
  const selectedMappedActivityType = selectedPending ? getActivityType(selectedPending.activityTypeId) : null;
  const selectedSamplePoints = selectedData && selectedMappedActivityType
    ? calculateSamplePoints(selectedData.sample, selectedMappedActivityType, selectedPending?.metricMapping)
    : null;

  return (
    <div className="space-y-3">
      {/* Status Message */}
      {statusMessage && (
        <div
          className={cn(
            "flex items-center gap-2 rounded px-3 py-2 text-xs",
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {statusMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Strava Activity Mappings ({mappedCount} configured)
        </h3>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column: Activity Types List */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Strava Activity Types
          </p>
          <div className="max-h-[600px] space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2">
            {stravaTypes.map(({ type, description }) => {
              const pending = getPendingOrExisting(type);
              const mappedId = pending?.activityTypeId ?? null;
              const mappedActivityType = getActivityType(mappedId);
              const hasChange = hasPendingChange(type);
              const isSelected = selectedType === type;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-amber-500/20 ring-1 ring-amber-500/50"
                      : hasChange
                        ? "bg-amber-500/10 hover:bg-amber-500/15"
                        : mappedId
                          ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                          : "hover:bg-zinc-800"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-200">{type}</span>
                      {hasChange && (
                        <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-medium text-amber-400">
                          UNSAVED
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-zinc-600">{description}</p>
                  </div>
                  {mappedId && (
                    <span className="ml-2 shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      {mappedActivityType?.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Mapping Preview */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Mapping Configuration
          </p>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            {selectedType && selectedData ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-zinc-200">{selectedType}</h4>
                    <p className="text-xs text-zinc-500">{selectedData.description}</p>
                  </div>
                  {hasPendingChange(selectedType) && (
                    <Button
                      size="sm"
                      onClick={() => handleSave(selectedType)}
                      disabled={savingTypes.has(selectedType)}
                      className="h-7 bg-amber-500 px-3 text-xs text-black hover:bg-amber-400"
                    >
                      {savingTypes.has(selectedType) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Save className="mr-1 h-3 w-3" />
                          Save
                        </>
                      )}
                    </Button>
                  )}
                  {getExistingMapping(selectedType) && !hasPendingChange(selectedType) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(selectedType)}
                      disabled={savingTypes.has(selectedType)}
                      className="h-7 text-xs text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Remove
                    </Button>
                  )}
                </div>

                {/* Sample Strava Data */}
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Sample Strava Activity
                  </p>
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedData.sample.distance && (
                        <>
                          <div>
                            <span className="text-zinc-600">distance_km:</span>
                            <span className="ml-2 font-mono text-emerald-400">
                              {(selectedData.sample.distance / 1000).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-600">distance_miles:</span>
                            <span className="ml-2 font-mono text-emerald-400">
                              {(selectedData.sample.distance / 1609.344).toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                      <div>
                        <span className="text-zinc-600">minutes:</span>
                        <span className="ml-2 font-mono text-emerald-400">
                          {Math.round(selectedData.sample.elapsed_time / 60)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-600">moving_minutes:</span>
                        <span className="ml-2 font-mono text-emerald-400">
                          {Math.round(selectedData.sample.moving_time / 60)}
                        </span>
                      </div>
                      {selectedData.sample.average_heartrate && (
                        <div>
                          <span className="text-zinc-600">avg_hr:</span>
                          <span className="ml-2 font-mono text-emerald-400">
                            {selectedData.sample.average_heartrate}
                          </span>
                        </div>
                      )}
                      {selectedData.sample.total_elevation_gain && (
                        <div>
                          <span className="text-zinc-600">elevation_m:</span>
                          <span className="ml-2 font-mono text-emerald-400">
                            {selectedData.sample.total_elevation_gain}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mapping Arrow */}
                <div className="flex items-center justify-center py-2">
                  <ArrowRight className="h-5 w-5 text-zinc-600" />
                </div>

                {/* Activity Type Selection */}
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Maps To Challenge Activity
                  </p>
                  <select
                    value={selectedPending?.activityTypeId ?? ""}
                    onChange={(e) => handleActivityTypeChange(selectedType, e.target.value)}
                    disabled={savingTypes.has(selectedType)}
                    className="h-10 w-full rounded border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-300 disabled:opacity-50"
                  >
                    <option value="">— Select activity type —</option>
                    {activityTypes.map((at) => (
                      <option key={at._id} value={at._id}>
                        {at.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Metric Selection (if mapped) */}
                {selectedPending?.activityTypeId && (
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Scoring Metric
                    </p>
                    <select
                      value={selectedPending?.metricMapping?.primaryMetric ?? ""}
                      onChange={(e) => handleMetricChange(selectedType, e.target.value)}
                      className="h-10 w-full rounded border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-300"
                    >
                      <option value="">Auto-detect from activity type</option>
                      {STRAVA_METRICS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scoring Preview */}
                {selectedMappedActivityType && (
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Scoring Preview
                    </p>
                    <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-zinc-400">
                            Activity Type: <span className="font-medium text-zinc-200">{selectedMappedActivityType.name}</span>
                          </p>
                          {selectedMappedActivityType.scoringConfig && (
                            <p className="mt-1 text-[10px] text-zinc-500">
                              Config: {selectedMappedActivityType.scoringConfig.basePoints !== undefined && (
                                <span>{String(selectedMappedActivityType.scoringConfig.basePoints)} base</span>
                              )}
                              {selectedMappedActivityType.scoringConfig.unit !== undefined && (
                                <span>
                                  {selectedMappedActivityType.scoringConfig.basePoints !== undefined ? " + " : ""}
                                  {String(selectedMappedActivityType.scoringConfig.pointsPerUnit ?? 1)} per {String(selectedMappedActivityType.scoringConfig.unit)}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        {selectedSamplePoints && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-400">
                              {selectedSamplePoints.points}
                            </p>
                            <p className="text-[10px] text-zinc-500">points</p>
                          </div>
                        )}
                      </div>
                      {selectedSamplePoints && (
                        <div className="mt-3 border-t border-emerald-500/20 pt-3">
                          <p className="font-mono text-xs text-zinc-400">
                            {selectedSamplePoints.breakdown}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            Using metric: <span className="text-amber-400">{selectedSamplePoints.metricUsed}</span>
                            {selectedSamplePoints.metricValue > 0 && (
                              <span> = {selectedSamplePoints.metricValue.toFixed(2)}</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-center">
                <div>
                  <p className="text-sm text-zinc-500">Select a Strava activity type</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Click on an activity from the list to configure its mapping
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
