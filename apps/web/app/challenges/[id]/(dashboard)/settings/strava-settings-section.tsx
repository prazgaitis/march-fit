"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Link2,
  Loader2,
  Map,
  RefreshCw,
  Trophy,
  Unplug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { captureAppException } from "@/lib/sentry";

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local?: string;
  elapsed_time: number;
  moving_time: number;
  distance?: number;
  total_photo_count?: number;
  photos?: {
    primary?: {
      urls?: Record<string, string>;
    };
    count?: number;
  };
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

interface ActivityWithScoring {
  stravaActivity: StravaActivity;
  scoring: ScoringPreview;
  alreadyImported: boolean;
}

interface StravaSettingsSectionProps {
  userId: Id<"users">;
  challengeId: Id<"challenges">;
}

export function StravaSettingsSection({
  userId,
  challengeId,
}: StravaSettingsSectionProps) {
  const integrations = useQuery(api.queries.integrations.getByUser, { userId });
  const stravaIntegration = integrations?.find(
    (i: { service: string; revoked: boolean }) =>
      i.service === "strava" && !i.revoked,
  );

  const unlinkStrava = useMutation(api.mutations.integrations.unlinkStrava);
  const testConnection = useAction(api.actions.strava.testStravaConnection);
  const importActivity = useAction(api.actions.strava.importStravaActivity);

  const [unlinking, setUnlinking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<Set<number>>(new Set());
  const [activities, setActivities] = useState<ActivityWithScoring[] | null>(null);
  const [tokenRefreshed, setTokenRefreshed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const sentryCtx = {
    area: "strava-settings",
    challengeId,
    userId,
  } as const;

  const handleUnlink = async () => {
    if (!window.confirm("Disconnect Strava? Your previously synced activities will be kept.")) {
      return;
    }
    setUnlinking(true);
    setError(null);
    try {
      await unlinkStrava({});
      setActivities(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to disconnect Strava";
      setError(msg);
      captureAppException(err, { ...sentryCtx, extra: { action: "unlinkStrava" } });
    } finally {
      setUnlinking(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setActivities(null);
    setTokenRefreshed(false);
    setImported(new Set());
    try {
      const result = await testConnection({ challengeId, perPage: 10 });
      setActivities(result.activities);
      setTokenRefreshed(result.tokenRefreshed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch activities";
      setError(msg);
      captureAppException(err, {
        ...sentryCtx,
        extra: { action: "testStravaConnection" },
      });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async (stravaActivity: StravaActivity) => {
    setImporting((prev) => new Set(prev).add(stravaActivity.id));
    try {
      await importActivity({
        challengeId,
        stravaActivityData: stravaActivity,
      });
      setImported((prev) => new Set(prev).add(stravaActivity.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import activity";
      setError(msg);
      captureAppException(err, {
        ...sentryCtx,
        extra: {
          action: "importStravaActivity",
          stravaActivityId: stravaActivity.id,
          sportType: stravaActivity.sport_type,
        },
      });
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(stravaActivity.id);
        return next;
      });
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Still loading integrations
  if (integrations === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Strava
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = !!stravaIntegration;

  return (
    <Card
      className={cn(
        isConnected &&
          "border-orange-500/30 bg-orange-500/5 ring-1 ring-orange-500/20",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Strava
            </CardTitle>
            <CardDescription>
              {isConnected
                ? "Connected — activities sync automatically via webhook"
                : "Connect Strava to automatically import your activities"}
            </CardDescription>
          </div>
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-orange-500" />
          ) : (
            <Link2 className="h-5 w-5 text-zinc-500" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
            <div className="flex items-start gap-2 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {error.includes("reconnect")
                    ? "Strava Connection Lost"
                    : error.includes("already been imported")
                      ? "Duplicate Activity"
                      : error.includes("No active Strava")
                        ? "Strava Not Connected"
                        : "Something went wrong"}
                </p>
                <p className="text-xs text-red-400/80 break-words">{error}</p>
                {error.includes("reconnect") && (
                  <p className="text-xs text-zinc-400">
                    Try disconnecting and reconnecting your Strava account below.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isConnected ? (
          <>
            {/* Connected actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
                className="gap-1.5"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Test Connection
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlink}
                disabled={unlinking}
                className="gap-1.5 text-zinc-400 hover:text-red-400"
              >
                {unlinking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            </div>

            {/* Token refreshed notice */}
            {tokenRefreshed && (
              <p className="text-xs text-blue-400">
                Access token was refreshed automatically.
              </p>
            )}

            {/* Activities list */}
            {activities && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-300">
                    Recent Activities ({activities.length})
                  </p>
                  <div className="flex items-center gap-1.5">
                    {activities.filter((a) => a.alreadyImported || imported.has(a.stravaActivity.id)).length > 0 && (
                      <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                        {activities.filter((a) => a.alreadyImported || imported.has(a.stravaActivity.id)).length}{" "}
                        synced
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {activities.filter((a) => a.scoring.mappingSource !== "none").length}{" "}
                      mapped
                    </Badge>
                  </div>
                </div>

                {activities.length === 0 && (
                  <p className="py-4 text-center text-sm text-zinc-500">
                    No recent activities found
                  </p>
                )}

                {activities.map(({ stravaActivity, scoring, alreadyImported }) => {
                  const isImported = alreadyImported || imported.has(stravaActivity.id);
                  const isImporting = importing.has(stravaActivity.id);
                  const canImport =
                    scoring.mappingSource !== "none" && !isImported && !isImporting;

                  return (
                    <div
                      key={stravaActivity.id}
                      className={cn(
                        "rounded-lg border p-3",
                        scoring.mappingSource === "none"
                          ? "border-zinc-800 bg-zinc-900/50"
                          : isImported
                            ? "border-emerald-500/20 bg-zinc-900/80"
                            : "border-zinc-700 bg-zinc-900",
                      )}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-medium text-zinc-200">
                            {stravaActivity.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {stravaActivity.start_date_local
                                ? format(
                                    new Date(stravaActivity.start_date_local),
                                    "MMM d, yyyy h:mm a",
                                  )
                                : format(
                                    new Date(stravaActivity.start_date),
                                    "MMM d, yyyy h:mm a",
                                  )}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {stravaActivity.sport_type}
                            </Badge>
                          </div>
                        </div>

                        {/* Points + action */}
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {scoring.mappingSource !== "none" && (
                            <div className="text-right">
                              <span
                                className={cn(
                                  "text-lg font-bold leading-none",
                                  scoring.bonusPoints > 0
                                    ? "text-amber-400"
                                    : "text-emerald-400",
                                )}
                              >
                                {scoring.totalPoints.toFixed(1)}
                              </span>
                              <span className="ml-1 text-xs text-zinc-500">pts</span>
                            </div>
                          )}
                          {isImported ? (
                            <Badge className="border-emerald-500/50 bg-emerald-500/20 text-emerald-400 text-xs whitespace-nowrap">
                              <Check className="mr-1 h-3 w-3" />
                              Synced
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canImport}
                              onClick={() => handleImport(stravaActivity)}
                              className="h-7 gap-1 px-2 text-xs"
                            >
                              {isImporting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              Import
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Metrics row */}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                        {stravaActivity.distance != null &&
                          stravaActivity.distance > 0 && (
                            <span className="flex items-center gap-1">
                              <Map className="h-3 w-3" />
                              {(
                                (scoring.metrics.distance_miles as number) || 0
                              ).toFixed(2)}{" "}
                              mi
                            </span>
                          )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {scoring.metrics.minutes as number} min
                        </span>
                        {scoring.mappingSource !== "none" && scoring.activityTypeName && (
                          <Badge variant="outline" className="text-[10px]">
                            {scoring.activityTypeName}
                          </Badge>
                        )}
                        {scoring.mappingSource === "none" && (
                          <span className="text-zinc-600">No mapping configured</span>
                        )}
                      </div>

                      {/* Triggered bonuses */}
                      {scoring.triggeredBonuses.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {scoring.triggeredBonuses.map((bonus, idx) => (
                            <span
                              key={idx}
                              className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400"
                            >
                              <Trophy className="h-2.5 w-2.5" />
                              {bonus.description} (+{bonus.bonusPoints})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expandable details */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(stravaActivity.id)}
                        className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                      >
                        Details
                        {expandedIds.has(stravaActivity.id) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      {expandedIds.has(stravaActivity.id) && (
                        <div className="mt-2 space-y-1.5 border-t border-zinc-800 pt-2 text-xs text-zinc-500">
                          <p>
                            <span className="text-zinc-400">Strava ID:</span>{" "}
                            {stravaActivity.id}
                          </p>
                          <p>
                            <span className="text-zinc-400">Type:</span>{" "}
                            {stravaActivity.type} / {stravaActivity.sport_type}
                          </p>
                          <p>
                            <span className="text-zinc-400">Elapsed:</span>{" "}
                            {Math.round(stravaActivity.elapsed_time / 60)} min |{" "}
                            <span className="text-zinc-400">Moving:</span>{" "}
                            {Math.round(stravaActivity.moving_time / 60)} min
                          </p>
                          {stravaActivity.distance != null && (
                            <p>
                              <span className="text-zinc-400">Distance:</span>{" "}
                              {(stravaActivity.distance / 1000).toFixed(2)} km /{" "}
                              {(stravaActivity.distance / 1609.344).toFixed(2)} mi
                            </p>
                          )}
                          <p>
                            <span className="text-zinc-400">Mapping:</span>{" "}
                            {scoring.mappingSource === "explicit"
                              ? "Configured"
                              : scoring.mappingSource === "fallback"
                                ? "Auto-matched"
                                : "None"}
                          </p>
                          {scoring.mappingSource !== "none" && (
                            <p>
                              <span className="text-zinc-400">Base:</span>{" "}
                              {scoring.basePoints.toFixed(1)} |{" "}
                              <span className="text-zinc-400">Bonus:</span>{" "}
                              {scoring.bonusPoints.toFixed(1)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Not connected */
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
              <li>Automatic activity sync via webhooks</li>
              <li>Supports distance, duration, and elevation metrics</li>
            </ul>
            <a
              href={`/api/strava/connect?successUrl=${encodeURIComponent(`/challenges/${challengeId}/settings`)}&errorUrl=${encodeURIComponent(`/challenges/${challengeId}/settings?error=strava_auth_failed`)}`}
              className="inline-block"
            >
              <img
                src="/strava-connect.svg"
                alt="Connect with Strava"
                className="h-11"
              />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
