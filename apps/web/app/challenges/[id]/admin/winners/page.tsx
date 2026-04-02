"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Crown,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Trophy,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WinnersBanner } from "@/components/challenges/winners-banner";

interface WinnerEntry {
  userId: string;
  placement: number;
  label?: string;
}

export default function WinnersAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;
  const [isSaving, setIsSaving] = useState(false);

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  const leaderboard = useQuery(
    api.queries.participations.getFullLeaderboard,
    { challengeId: challengeId as Id<"challenges"> },
  );

  const updateChallenge = useMutation(
    api.mutations.challenges.updateChallenge,
  );

  const isFinished = !!challenge?.finishedAt;
  const currentWinners: WinnerEntry[] = (challenge?.winners as WinnerEntry[]) ?? [];

  // Local state for editing winners
  const [editingWinners, setEditingWinners] = useState<WinnerEntry[] | null>(null);
  const winners = editingWinners ?? currentWinners;

  const setWinners = (w: WinnerEntry[]) => setEditingWinners(w);

  const isDirty = editingWinners !== null;

  async function handleToggleFinished() {
    const action = isFinished ? "reopen" : "finalize";
    if (
      !confirm(
        isFinished
          ? "Reopen this challenge? Users will be able to log activities again."
          : "Mark this challenge as finished? Users will no longer be able to log activities.",
      )
    )
      return;

    setIsSaving(true);
    try {
      await updateChallenge({
        challengeId: challengeId as Id<"challenges">,
        finishedAt: isFinished ? (0 as any) : Date.now(),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveWinners() {
    setIsSaving(true);
    try {
      await updateChallenge({
        challengeId: challengeId as Id<"challenges">,
        winners: winners.map((w) => ({
          userId: w.userId as Id<"users">,
          placement: w.placement,
          label: w.label || undefined,
        })),
      });
      setEditingWinners(null);
    } finally {
      setIsSaving(false);
    }
  }

  function addWinner() {
    const nextPlacement = winners.length > 0
      ? Math.max(...winners.map((w) => w.placement)) + 1
      : 1;
    setWinners([...winners, { userId: "", placement: nextPlacement }]);
  }

  function removeWinner(index: number) {
    setWinners(winners.filter((_, i) => i !== index));
  }

  function updateWinner(index: number, updates: Partial<WinnerEntry>) {
    setWinners(
      winners.map((w, i) => (i === index ? { ...w, ...updates } : w)),
    );
  }

  if (!challenge) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  // Build preview winners with user data from leaderboard
  const previewWinners = winners
    .filter((w) => w.userId)
    .map((w) => {
      const entry = leaderboard?.find((e: any) => e.user.id === w.userId);
      return {
        ...w,
        user: entry?.user ?? null,
        totalPoints: entry?.totalPoints,
      };
    });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Winners & Finish</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Mark the challenge as finished and configure winners
        </p>
      </div>

      {/* Finish Toggle */}
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border px-4 py-3",
          isFinished
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-zinc-800 bg-zinc-900",
        )}
      >
        <div className="flex items-center gap-3">
          {isFinished ? (
            <Lock className="h-5 w-5 text-amber-400" />
          ) : (
            <Unlock className="h-5 w-5 text-zinc-500" />
          )}
          <div>
            <div className="text-sm font-semibold text-white">
              {isFinished ? "Challenge Finished" : "Challenge Open"}
            </div>
            <div className="text-xs text-zinc-500">
              {isFinished
                ? "Activity logging is locked. Users see the winners banner."
                : "Users can still log activities."}
            </div>
          </div>
        </div>
        <Button
          variant={isFinished ? "outline" : "default"}
          size="sm"
          onClick={handleToggleFinished}
          disabled={isSaving}
          className={cn(
            isFinished
              ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              : "bg-amber-600 hover:bg-amber-500",
          )}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : isFinished ? (
            <Unlock className="mr-2 h-3 w-3" />
          ) : (
            <Lock className="mr-2 h-3 w-3" />
          )}
          {isFinished ? "Reopen" : "Mark Finished"}
        </Button>
      </div>

      {/* Winners Configuration */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">
              Configure Winners
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Set placement and select users. Use the same placement number for
            ties.
          </p>
        </div>

        <div className="space-y-2 p-4">
          {winners.map((winner, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md border border-zinc-800/50 bg-zinc-950 px-3 py-2"
            >
              {/* Placement */}
              <div className="flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <input
                  type="number"
                  min={1}
                  value={winner.placement}
                  onChange={(e) =>
                    updateWinner(index, {
                      placement: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-12 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-center font-mono text-sm text-white"
                />
              </div>

              {/* User Select */}
              <select
                value={winner.userId}
                onChange={(e) =>
                  updateWinner(index, { userId: e.target.value })
                }
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-white"
              >
                <option value="">Select user...</option>
                {leaderboard?.map((entry: any) => (
                  <option key={entry.user.id} value={entry.user.id}>
                    {entry.user.name ?? entry.user.username} (
                    {Math.trunc(entry.totalPoints).toLocaleString()} pts)
                  </option>
                ))}
              </select>

              {/* Label */}
              <input
                type="text"
                value={winner.label ?? ""}
                onChange={(e) =>
                  updateWinner(index, {
                    label: e.target.value || undefined,
                  })
                }
                placeholder="Label (optional)"
                className="w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300 placeholder:text-zinc-600"
              />

              {/* Remove */}
              <button
                onClick={() => removeWinner(index)}
                className="text-zinc-600 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={addWinner}
              className="text-zinc-400 hover:text-white"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Winner
            </Button>

            {isDirty && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingWinners(null)}
                  className="text-zinc-500"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveWinners}
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-500"
                >
                  {isSaving && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  Save Winners
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      {previewWinners.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Preview
          </h3>
          <WinnersBanner winners={previewWinners} />
        </div>
      )}
    </div>
  );
}
