"use client";

import { Zap, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrWeekCardProps {
  gameName: string;
  endsAt: number;
  startsAt: number;
  challengeId: string;
  initialPr: number;
  currentWeekMax: number;
  prBonus?: number;
}

export function PrWeekCard({
  gameName,
  endsAt,
  initialPr,
  currentWeekMax,
  prBonus = 100,
}: PrWeekCardProps) {
  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const hitPr = currentWeekMax > initialPr;
  const progress = initialPr > 0 ? Math.min((currentWeekMax / initialPr) * 100, 150) : 0;
  const pointsToGo = Math.max(0, initialPr - currentWeekMax + 1);

  return (
    <div className="rounded-lg border border-zinc-800 bg-gradient-to-br from-amber-950/30 to-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{gameName}</h3>
            <p className="text-xs text-zinc-500">
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Bonus</p>
          <p
            className={cn(
              "text-lg font-bold",
              hitPr ? "text-emerald-400" : "text-zinc-500"
            )}
          >
            {hitPr ? `+${prBonus}` : `+0`}
          </p>
        </div>
      </div>

      {/* PR Status */}
      <div className="mt-4">
        {hitPr ? (
          <div className="rounded-lg bg-emerald-500/10 p-4 ring-1 ring-emerald-500/30">
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-6 w-6 text-amber-400" />
              <span className="text-lg font-bold text-emerald-400">
                New PR Achieved!
              </span>
            </div>
            <p className="mt-2 text-center text-sm text-zinc-400">
              You beat your record of {initialPr} pts with {currentWeekMax} pts!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">Your PR to Beat</p>
                <p className="text-2xl font-bold text-amber-400">{initialPr}</p>
                <p className="text-xs text-zinc-500">points in a day</p>
              </div>
              <TrendingUp className="h-8 w-8 text-zinc-700" />
              <div className="text-right">
                <p className="text-xs text-zinc-500">Best Day This Week</p>
                <p className="text-2xl font-bold text-zinc-300">{currentWeekMax}</p>
                <p className="text-xs text-zinc-500">points</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress >= 100
                      ? "bg-emerald-500"
                      : progress >= 75
                        ? "bg-amber-500"
                        : "bg-zinc-600"
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{progress.toFixed(0)}% of PR</span>
                {!hitPr && initialPr > 0 && (
                  <span>{pointsToGo} pts to go</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3 text-center text-xs text-zinc-500">
        Beat your daily point record to earn +{prBonus} bonus
      </div>
    </div>
  );
}
