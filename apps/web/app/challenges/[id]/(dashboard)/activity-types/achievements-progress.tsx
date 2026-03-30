"use client";

import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface AchievementsProgressProps {
  challengeId: Id<"challenges">;
}

type ProgressItem = {
  achievementId: string;
  name: string;
  description: string;
  bonusPoints: number;
  criteriaType: string;
  currentCount: number;
  requiredCount: number;
  isEarned: boolean;
};

function formatProgress(item: ProgressItem): string {
  const { criteriaType, currentCount, requiredCount } = item;
  const current = Number.isInteger(currentCount)
    ? currentCount
    : currentCount.toFixed(1);
  switch (criteriaType) {
    case "cumulative":
      return `${current} / ${requiredCount}`;
    case "distinct_types":
    case "one_of_each":
      return `${currentCount} / ${requiredCount} types`;
    case "streak":
      return `${currentCount} / ${requiredCount} days`;
    case "count":
    default:
      return `${currentCount} / ${requiredCount} activities`;
  }
}

export function AchievementsProgress({
  challengeId,
}: AchievementsProgressProps) {
  const progress = useQuery(api.queries.achievements.getUserProgress, {
    challengeId,
  });

  if (progress === undefined || progress.length === 0) return null;

  const earned = progress.filter((a: ProgressItem) => a.isEarned);
  const available = progress.filter((a: ProgressItem) => !a.isEarned);

  return (
    <div className="rounded-lg border border-zinc-800 bg-gradient-to-br from-amber-950/30 to-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
            <Award className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Achievements
            </h3>
            <p className="text-xs text-zinc-500">
              {earned.length > 0
                ? `${earned.length} of ${progress.length} earned`
                : "Earn bonus points by hitting milestones"}
            </p>
          </div>
        </div>
        {earned.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">Earned</p>
            <p className="text-lg font-bold tabular-nums text-emerald-400">
              +{earned.reduce((sum: number, a: ProgressItem) => sum + a.bonusPoints, 0)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        {/* Earned */}
        {earned.map((item: ProgressItem) => (
          <div
            key={item.achievementId}
            className="rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-zinc-200">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-bold tabular-nums text-emerald-400">
                  +{item.bonusPoints}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Separator */}
        {earned.length > 0 && available.length > 0 && (
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            In progress
          </p>
        )}

        {/* Available */}
        {available.map((item: ProgressItem) => {
          const pct =
            item.requiredCount > 0
              ? Math.min(
                  100,
                  Math.round(
                    (item.currentCount / item.requiredCount) * 100,
                  ),
                )
              : 0;
          return (
            <div
              key={item.achievementId}
              className="rounded-lg bg-zinc-900/50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-zinc-400">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm tabular-nums text-zinc-500">
                    +{item.bonusPoints}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-2.5 space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      pct >= 75
                        ? "bg-amber-500"
                        : pct >= 40
                          ? "bg-amber-500/60"
                          : "bg-zinc-600",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] tabular-nums text-zinc-600">
                  <span>{formatProgress(item)}</span>
                  <span>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
