"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  Medal,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PLACEMENT_ICONS = [Crown, Medal, Medal] as const;
const PLACEMENT_COLORS = [
  "text-amber-400",
  "text-zinc-300",
  "text-amber-700",
] as const;

export default function CategoryLeadersPage() {
  const params = useParams();
  const challengeId = params.id as Id<"challenges">;

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weekInitialized, setWeekInitialized] = useState(false);
  const [applying, setApplying] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [result, setResult] = useState<{
    awarded?: number;
    revoked?: number;
    skipped?: number;
    weekNumber: number;
    isCumulative: boolean;
  } | null>(null);

  const preview = useQuery(
    api.queries.categoryLeaderAwards.previewWeeklyAwards,
    { challengeId, weekNumber: selectedWeek }
  );

  const applyAwards = useMutation(
    api.mutations.categoryLeaderAwards.applyWeeklyAwards
  );
  const revokeAwards = useMutation(
    api.mutations.categoryLeaderAwards.revokeWeeklyAwards
  );

  const challenge = useQuery(api.queries.challenges.getById, { challengeId });

  // Auto-select most recent completed week on first load
  if (preview && !weekInitialized) {
    const targetWeek = Math.max(1, Math.min(preview.currentWeek - 1, preview.totalWeeks));
    if (targetWeek !== selectedWeek) {
      setSelectedWeek(targetWeek);
    }
    setWeekInitialized(true);
  }

  const handleApply = async () => {
    setApplying(true);
    setResult(null);
    try {
      const res = await applyAwards({ challengeId, weekNumber: selectedWeek });
      setResult(res);
    } finally {
      setApplying(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Revoke all category leader awards for this period? This will remove the bonus activities and reverse the points.")) {
      return;
    }
    setRevoking(true);
    setResult(null);
    try {
      const res = await revokeAwards({ challengeId, weekNumber: selectedWeek });
      setResult(res);
    } finally {
      setRevoking(false);
    }
  };

  if (!challenge) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  const isCumulative = selectedWeek === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">
          Category Leader Awards
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Award bonus points to top 3 category leaders per week
        </p>
      </div>

      {/* Points Reference */}
      {preview && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {isCumulative ? "Cumulative" : `Week ${preview.weekNumber}`} Points
          </div>
          <div className="flex items-center gap-4">
            {preview.placementPoints.map((pts: number, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-xs font-medium",
                    PLACEMENT_COLORS[i]
                  )}
                >
                  {i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"}
                </span>
                <span className="font-mono text-sm font-semibold text-zinc-100">
                  {pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week Selector */}
      {preview && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={selectedWeek <= 0}
            onClick={() => setSelectedWeek((w) => Math.max(0, w - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-1 items-center justify-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">
              {isCumulative ? "Cumulative" : `Week ${preview.weekNumber}`}
            </span>
            {!isCumulative && (
              <span className="text-xs text-zinc-500">
                of {preview.totalWeeks}
              </span>
            )}
            {!isCumulative &&
              preview.weekNumber === preview.currentWeek && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                  Current
                </span>
              )}
            {preview.alreadyApplied && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                <CheckCircle2 className="h-3 w-3" />
                Applied
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={selectedWeek >= preview.totalWeeks}
            onClick={() =>
              setSelectedWeek((w) => Math.min(preview.totalWeeks, w + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Applied Summary */}
      {preview && preview.appliedWeeks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span>
            Applied:{" "}
            {preview.appliedWeeks
              .sort((a: number, b: number) => a - b)
              .map((w: number) => (w === 0 ? "Cumulative" : `W${w}`))
              .join(", ")}
          </span>
        </div>
      )}

      {/* Awards Preview */}
      {!preview ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : preview.awards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 py-12">
          <Trophy className="h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No category leaders for {isCumulative ? "cumulative" : "this week"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {preview.awards.map((award: any) => (
            <div
              key={award.category.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900"
            >
              {/* Category header */}
              <div className="border-b border-zinc-800/50 px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {award.category.name}
                </span>
              </div>

              {/* Placements */}
              <div className="divide-y divide-zinc-800/50">
                {award.placements.map((p: any) => {
                  const Icon = PLACEMENT_ICONS[p.placement - 1] ?? Medal;
                  const color =
                    PLACEMENT_COLORS[p.placement - 1] ?? "text-zinc-500";

                  return (
                    <div
                      key={p.user.userId}
                      className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-800/30"
                    >
                      {/* Placement icon */}
                      <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />

                      {/* User */}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {p.user.avatarUrl ? (
                          <img
                            src={p.user.avatarUrl}
                            alt=""
                            className="h-5 w-5 rounded-full"
                          />
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                            {(
                              p.user.name ?? p.user.username
                            )?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="truncate text-sm text-zinc-300">
                          {p.user.name ?? p.user.username}
                        </span>
                      </div>

                      {/* Category points */}
                      <span className="font-mono text-xs text-zinc-500">
                        {p.totalPoints} pts
                      </span>

                      {/* Bonus */}
                      <span className="min-w-[4rem] text-right font-mono text-sm font-medium text-emerald-400">
                        +{p.bonusPoints}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result Message */}
      {result && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            result.revoked !== undefined
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {result.isCumulative ? "Cumulative" : `Week ${result.weekNumber}`}
            :{" "}
            {result.revoked !== undefined
              ? `${result.revoked} award${result.revoked !== 1 ? "s" : ""} revoked`
              : `${result.awarded} award${result.awarded !== 1 ? "s" : ""} applied${result.skipped ? `, ${result.skipped} skipped` : ""}`}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {preview && preview.awards.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          {preview.alreadyApplied && (
            <Button
              variant="ghost"
              onClick={handleRevoke}
              disabled={revoking}
              className="gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Award className="h-4 w-4" />
              )}
              Revoke Awards
            </Button>
          )}
          <Button
            onClick={handleApply}
            disabled={applying || preview.alreadyApplied}
            className={cn(
              "gap-2",
              preview.alreadyApplied
                ? "bg-zinc-800 text-zinc-500"
                : "bg-amber-600 text-white hover:bg-amber-500"
            )}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : preview.alreadyApplied ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            {preview.alreadyApplied
              ? "Already Applied"
              : `Apply ${isCumulative ? "Cumulative" : `Week ${preview.weekNumber}`} Awards`}
          </Button>
        </div>
      )}
    </div>
  );
}
