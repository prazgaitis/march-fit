"use client";

import { Target, AlertTriangle, Check } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface HuntWeekCardProps {
  gameName: string;
  endsAt: number;
  challengeId: string;
  prey: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
  hunter: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
  userCurrentPoints: number | null;
  preyCurrentPoints: number | null;
  hunterCurrentPoints: number | null;
  catchBonus?: number;
  caughtPenalty?: number;
}

export function HuntWeekCard({
  gameName,
  endsAt,
  challengeId,
  prey,
  hunter,
  userCurrentPoints,
  preyCurrentPoints,
  hunterCurrentPoints,
  catchBonus = 75,
  caughtPenalty = 25,
}: HuntWeekCardProps) {
  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Calculate if user has caught prey or been caught
  const hasCaughtPrey =
    prey &&
    userCurrentPoints !== null &&
    preyCurrentPoints !== null &&
    userCurrentPoints > preyCurrentPoints;

  const hasBeenCaught =
    hunter &&
    userCurrentPoints !== null &&
    hunterCurrentPoints !== null &&
    hunterCurrentPoints > userCurrentPoints;

  // Calculate current bonus preview
  let currentBonus = 0;
  if (hasCaughtPrey) currentBonus += catchBonus;
  if (hasBeenCaught) currentBonus -= caughtPenalty;

  // Calculate gaps
  const preyGap =
    prey && userCurrentPoints !== null && preyCurrentPoints !== null
      ? preyCurrentPoints - userCurrentPoints
      : null;

  const hunterGap =
    hunter && userCurrentPoints !== null && hunterCurrentPoints !== null
      ? userCurrentPoints - hunterCurrentPoints
      : null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-gradient-to-br from-red-950/30 to-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
            <Target className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{gameName}</h3>
            <p className="text-xs text-zinc-500">
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Current Bonus</p>
          <p
            className={cn(
              "text-lg font-bold",
              currentBonus > 0
                ? "text-emerald-400"
                : currentBonus < 0
                  ? "text-red-400"
                  : "text-zinc-500"
            )}
          >
            {currentBonus > 0 ? "+" : ""}
            {currentBonus}
          </p>
        </div>
      </div>

      {/* Prey Section */}
      <div className="mt-4 space-y-3">
        {prey ? (
          <div
            className={cn(
              "rounded-lg p-3",
              hasCaughtPrey
                ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "bg-zinc-900/50"
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Your Prey
              </p>
              {hasCaughtPrey && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  <Check className="h-3 w-3" />
                  Caught!
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <UserAvatar
                user={prey}
                challengeId={challengeId}
                size="sm"
                showName
              />
              <div className="text-right">
                {preyGap !== null && (
                  <p
                    className={cn(
                      "text-sm font-medium",
                      preyGap > 0 ? "text-red-400" : "text-emerald-400"
                    )}
                  >
                    {preyGap > 0
                      ? `${preyGap.toFixed(0)} pts ahead`
                      : `${Math.abs(preyGap).toFixed(0)} pts behind`}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-zinc-900/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Your Prey
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              None (You&apos;re in 1st place!)
            </p>
          </div>
        )}

        {/* Hunter Section */}
        {hunter ? (
          <div
            className={cn(
              "rounded-lg p-3",
              hasBeenCaught
                ? "bg-red-500/10 ring-1 ring-red-500/30"
                : "bg-zinc-900/50"
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Your Hunter
              </p>
              {hasBeenCaught && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  Caught you!
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <UserAvatar
                user={hunter}
                challengeId={challengeId}
                size="sm"
                showName
              />
              <div className="text-right">
                {hunterGap !== null && (
                  <p
                    className={cn(
                      "text-sm font-medium",
                      hunterGap > 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {hunterGap > 0
                      ? `${hunterGap.toFixed(0)} pts behind`
                      : `${Math.abs(hunterGap).toFixed(0)} pts ahead`}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-zinc-900/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Your Hunter
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              None (You&apos;re in last place)
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>Catch prey: +{catchBonus}</span>
        <span>Get caught: -{caughtPenalty}</span>
      </div>
    </div>
  );
}
