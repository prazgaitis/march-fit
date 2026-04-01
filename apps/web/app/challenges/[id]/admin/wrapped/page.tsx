"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Eye,
  Gift,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function WrappedAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  const leaderboard = useQuery(api.queries.participations.getFullLeaderboard, {
    challengeId: challengeId as Id<"challenges">,
  });

  const updateChallenge = useMutation(
    api.mutations.challenges.updateChallenge
  );

  const previewData = useQuery(
    api.queries.wrapped.getWrappedPreview,
    selectedUserId
      ? {
          challengeId: challengeId as Id<"challenges">,
          userId: selectedUserId as Id<"users">,
        }
      : "skip"
  );

  const isEnabled = challenge?.wrappedEnabled === true;

  async function handleToggle() {
    setIsSaving(true);
    try {
      await updateChallenge({
        challengeId: challengeId as Id<"challenges">,
        wrappedEnabled: !isEnabled,
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!challenge) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Wrapped</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          End-of-challenge summary for each participant
        </p>
      </div>

      {/* Toggle Card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                isEnabled ? "bg-emerald-500/20" : "bg-zinc-800"
              )}
            >
              <Gift
                className={cn(
                  "h-4 w-4",
                  isEnabled ? "text-emerald-400" : "text-zinc-500"
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Wrapped Visibility
              </p>
              <p className="text-xs text-zinc-500">
                {isEnabled
                  ? "Participants can view their Wrapped summary"
                  : "Wrapped is hidden from participants"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {!isSaving && isEnabled && (
              <ToggleRight className="h-5 w-5 text-emerald-400" />
            )}
            {!isSaving && !isEnabled && (
              <ToggleLeft className="h-5 w-5 text-zinc-500" />
            )}
            <span className={isEnabled ? "text-emerald-400" : "text-zinc-500"}>
              {isEnabled ? "Enabled" : "Disabled"}
            </span>
          </Button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-200">
            Preview Wrapped
          </h2>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Select Participant
            </label>
            <select
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Choose a participant...</option>
              {leaderboard
                ?.filter((p: any) => p.user)
                .map((p: any) => (
                  <option key={p.user.id} value={p.user.id}>
                    #{p.rank} {p.user.name ?? p.user.username} (
                    {Math.round(p.totalPoints)} pts)
                  </option>
                ))}
            </select>
          </div>
          {selectedUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `/challenges/${challengeId}/wrapped?preview=${selectedUserId}`,
                  "_blank"
                )
              }
              className="gap-1.5 border-zinc-700"
            >
              <Eye className="h-3.5 w-3.5" />
              Open Full Preview
            </Button>
          )}
        </div>

        {/* Inline Preview Data */}
        {selectedUserId && previewData && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
              <div className="flex items-center gap-3 mb-3">
                {previewData.avatarUrl && (
                  <img
                    src={previewData.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {previewData.userName}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    #{previewData.rank} of {previewData.totalParticipants}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatBox
                  label="Points"
                  value={previewData.totalPoints.toLocaleString()}
                />
                <StatBox
                  label="Activities"
                  value={previewData.totalActivities.toString()}
                />
                <StatBox
                  label="Streak"
                  value={`${previewData.currentStreak}d`}
                />
                <StatBox
                  label="Distance"
                  value={`${previewData.totalDistanceMiles.toLocaleString()}mi`}
                />
                <StatBox
                  label="Time"
                  value={`${Math.round(previewData.totalMinutes / 60)}h`}
                />
                <StatBox
                  label="Categories"
                  value={previewData.categoryBreakdown.length.toString()}
                />
              </div>

              {previewData.favoriteActivity && (
                <div className="mt-2 text-xs text-zinc-400">
                  Favorite:{" "}
                  <span className="text-zinc-200">
                    {previewData.favoriteActivity.name}
                  </span>{" "}
                  ({previewData.favoriteActivity.count}x)
                </div>
              )}

              {previewData.biggestFan && (
                <div className="mt-1 text-xs text-zinc-400">
                  Biggest fan:{" "}
                  <span className="text-zinc-200">
                    {previewData.biggestFan.name}
                  </span>
                </div>
              )}

              {previewData.miniGameResults.length > 0 && (
                <div className="mt-1 text-xs text-zinc-400">
                  Mini-games:{" "}
                  {previewData.miniGameResults.map((g: any, i: number) => (
                    <span key={i} className="text-zinc-200">
                      {g.outcome}
                      {i < previewData.miniGameResults.length - 1 ? " | " : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedUserId && !previewData && (
          <div className="mt-4 flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-200">
            Slide Coverage
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          The Wrapped experience includes up to 15 slides covering personal
          stats, community totals, category leaders, leaderboard, mini-game
          results, and achievements. Slides with no data are automatically
          skipped for each participant.
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-900 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="font-mono text-sm font-medium tabular-nums text-zinc-200">
        {value}
      </p>
    </div>
  );
}
