"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Map,
  RefreshCw,
  Trophy,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ParticipantWithStrava {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  integration: {
    id: string;
    athleteId?: number;
    accessToken: string;
    refreshToken: string;
    expiresAt?: number;
  };
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance?: number;
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
}

interface StravaPreviewClientProps {
  challengeId: string;
  participantsWithStrava: ParticipantWithStrava[];
}

export function StravaPreviewClient({
  challengeId,
  participantsWithStrava,
}: StravaPreviewClientProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityWithScoring[] | null>(null);
  const [tokenRefreshed, setTokenRefreshed] = useState(false);

  const fetchActivities = useAction(api.actions.strava.fetchActivitiesWithScoringPreview);

  const selectedParticipant = participantsWithStrava.find((p) => p.id === selectedUserId);

  const handleFetchActivities = async () => {
    if (!selectedParticipant) return;

    setLoading(true);
    setError(null);
    setActivities(null);
    setTokenRefreshed(false);

    try {
      const result = await fetchActivities({
        integrationId: selectedParticipant.integration.id as Id<"userIntegrations">,
        challengeId: challengeId as Id<"challenges">,
        accessToken: selectedParticipant.integration.accessToken,
        refreshToken: selectedParticipant.integration.refreshToken,
        expiresAt: selectedParticipant.integration.expiresAt ?? 0,
        perPage: 20,
      });

      setActivities(result.activities);
      setTokenRefreshed(result.tokenRefreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activities");
    } finally {
      setLoading(false);
    }
  };

  if (participantsWithStrava.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="mb-4 h-12 w-12 text-zinc-500" />
        <h3 className="text-lg font-medium text-zinc-300">No Strava connections found</h3>
        <p className="mt-2 text-sm text-zinc-500">
          No participants in this challenge have connected their Strava account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Selection */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-zinc-300">Select Participant</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a participant with Strava connected" />
            </SelectTrigger>
            <SelectContent>
              {participantsWithStrava.map((participant) => (
                <SelectItem key={participant.id} value={participant.id}>
                  <div className="flex items-center gap-2">
                    {participant.avatarUrl ? (
                      <img
                        src={participant.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <User className="h-5 w-5 text-zinc-500" />
                    )}
                    <span>{participant.name || participant.username}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleFetchActivities}
          disabled={!selectedUserId || loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Fetch Activities
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Token Refreshed Notice */}
      {tokenRefreshed && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 text-blue-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>Access token was refreshed automatically</span>
        </div>
      )}

      {/* Activities List */}
      {activities && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-zinc-200">
              Recent Activities ({activities.length})
            </h3>
            <Badge variant="outline">
              {activities.filter((a) => a.scoring.mappingSource !== "none").length} mapped
            </Badge>
          </div>

          <div className="space-y-3">
            {activities.map(({ stravaActivity, scoring }) => (
              <div
                key={stravaActivity.id}
                className={cn(
                  "rounded-lg border p-4",
                  scoring.mappingSource === "none"
                    ? "border-zinc-800 bg-zinc-900/50"
                    : "border-zinc-700 bg-zinc-900"
                )}
              >
                {/* Activity Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-zinc-400" />
                      <span className="font-medium text-zinc-200">
                        {stravaActivity.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(stravaActivity.start_date), "MMM d, yyyy h:mm a")}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {stravaActivity.sport_type}
                      </Badge>
                    </div>
                  </div>

                  {/* Points Badge */}
                  {scoring.mappingSource !== "none" && (
                    <div className="text-right">
                      <div
                        className={cn(
                          "text-2xl font-bold",
                          scoring.bonusPoints > 0 ? "text-amber-400" : "text-emerald-400"
                        )}
                      >
                        {scoring.totalPoints.toFixed(1)}
                      </div>
                      <div className="text-xs text-zinc-500">points</div>
                    </div>
                  )}
                </div>

                {/* Metrics Row */}
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {stravaActivity.distance && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Map className="h-3.5 w-3.5" />
                      <span>
                        {((scoring.metrics.distance_miles as number) || 0).toFixed(2)} mi
                        {" / "}
                        {((scoring.metrics.distance_km as number) || 0).toFixed(2)} km
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {scoring.metrics.minutes as number} min
                      {scoring.metrics.moving_minutes !== scoring.metrics.minutes && (
                        <span className="text-zinc-600">
                          {" "}({scoring.metrics.moving_minutes as number} moving)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Scoring Details */}
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  {scoring.mappingSource === "none" ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        No mapping found for <strong>{stravaActivity.sport_type}</strong> -
                        configure an integration mapping to score this activity type
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">Maps to:</span>
                          <Badge variant="default">{scoring.activityTypeName}</Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              scoring.mappingSource === "explicit"
                                ? "border-emerald-500/50 text-emerald-400"
                                : "border-amber-500/50 text-amber-400"
                            )}
                          >
                            {scoring.mappingSource === "explicit" ? "Configured" : "Auto-matched"}
                          </Badge>
                        </div>
                      </div>

                      {/* Points Breakdown */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-zinc-400">
                          Base: <span className="font-mono text-zinc-300">{scoring.basePoints.toFixed(1)}</span>
                        </span>
                        {scoring.bonusPoints > 0 && (
                          <span className="text-amber-400">
                            Bonuses: <span className="font-mono">+{scoring.bonusPoints}</span>
                          </span>
                        )}
                      </div>

                      {/* Triggered Bonuses */}
                      {scoring.triggeredBonuses.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {scoring.triggeredBonuses.map((bonus, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-400"
                            >
                              <Trophy className="h-3 w-3" />
                              {bonus.description} (+{bonus.bonusPoints})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {activities.length === 0 && (
            <div className="py-8 text-center text-zinc-500">
              No recent activities found for this user
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!activities && !loading && !error && selectedUserId && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="mb-4 h-12 w-12 text-zinc-500" />
          <p className="text-zinc-500">
            Click &ldquo;Fetch Activities&rdquo; to load recent Strava activities
          </p>
        </div>
      )}
    </div>
  );
}
