"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  Check,
  Gamepad2,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UserMiniGamesProps {
  challengeId: string;
  userId: string;
}

type MiniGameType = "partner_week" | "hunt_week" | "pr_week";

const gameTypeInfo: Record<
  MiniGameType,
  { label: string; icon: typeof Users; color: string }
> = {
  partner_week: {
    label: "Partner Week",
    icon: Users,
    color: "text-indigo-400",
  },
  hunt_week: {
    label: "Hunt Week",
    icon: Target,
    color: "text-red-400",
  },
  pr_week: {
    label: "PR Week",
    icon: Zap,
    color: "text-amber-400",
  },
};

export function UserMiniGames({ challengeId, userId }: UserMiniGamesProps) {
  const miniGameHistory = useQuery(api.queries.miniGames.getUserHistory, {
    challengeId: challengeId as Id<"challenges">,
    userId: userId as Id<"users">,
  });

  if (!miniGameHistory || miniGameHistory.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gamepad2 className="h-5 w-5 text-purple-500" />
          Mini-Games
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {miniGameHistory.map((item: (typeof miniGameHistory)[number]) => {
          const { miniGame, participation } = item;
          const typeInfo = gameTypeInfo[miniGame.type as MiniGameType];
          const Icon = typeInfo.icon;
          const isCompleted = miniGame.status === "completed";
          const outcome = participation.outcome as Record<string, unknown> | null;

          return (
            <div
              key={miniGame.id}
              className={cn(
                "rounded-lg border p-3",
                isCompleted
                  ? "border-zinc-800 bg-zinc-900/50"
                  : "border-emerald-500/30 bg-emerald-500/5"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", typeInfo.color)} />
                  <span className="text-sm font-medium text-zinc-200">
                    {miniGame.name}
                  </span>
                  {!isCompleted && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      Active
                    </span>
                  )}
                </div>
                {participation.bonusPoints !== undefined &&
                  participation.bonusPoints !== null && (
                    <span
                      className={cn(
                        "text-sm font-bold",
                        participation.bonusPoints > 0
                          ? "text-emerald-400"
                          : participation.bonusPoints < 0
                            ? "text-red-400"
                            : "text-zinc-500"
                      )}
                    >
                      {participation.bonusPoints > 0 ? "+" : ""}
                      {participation.bonusPoints} pts
                    </span>
                  )}
              </div>

              {/* Date range */}
              <div className="mt-1 text-xs text-zinc-500">
                {format(new Date(miniGame.startsAt), "MMM d")} -{" "}
                {format(new Date(miniGame.endsAt), "MMM d, yyyy")}
              </div>

              {/* Game-specific details */}
              <div className="mt-2">
                {miniGame.type === "partner_week" && (
                  <PartnerWeekResult
                    challengeId={challengeId}
                    partner={participation.partnerUser}
                    outcome={outcome}
                    isCompleted={isCompleted}
                  />
                )}
                {miniGame.type === "hunt_week" && (
                  <HuntWeekResult
                    challengeId={challengeId}
                    prey={participation.preyUser}
                    hunter={participation.hunterUser}
                    outcome={outcome}
                    isCompleted={isCompleted}
                  />
                )}
                {miniGame.type === "pr_week" && (
                  <PrWeekResult
                    initialState={participation.initialState}
                    outcome={outcome}
                    isCompleted={isCompleted}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PartnerWeekResult({
  challengeId,
  partner,
  outcome,
  isCompleted,
}: {
  challengeId: string;
  partner: { id: string; username: string; name: string | null; avatarUrl: string | null } | null;
  outcome: Record<string, unknown> | null;
  isCompleted: boolean;
}) {
  if (!partner) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Partner:</span>
        <UserAvatar user={partner} challengeId={challengeId} size="sm" showName />
      </div>
      {isCompleted && typeof outcome?.partnerWeekPoints === 'number' && (
        <span className="text-xs text-zinc-400">
          Partner earned {outcome.partnerWeekPoints} pts
        </span>
      )}
    </div>
  );
}

function HuntWeekResult({
  challengeId,
  prey,
  hunter,
  outcome,
  isCompleted,
}: {
  challengeId: string;
  prey: { id: string; username: string; name: string | null; avatarUrl: string | null } | null;
  hunter: { id: string; username: string; name: string | null; avatarUrl: string | null } | null;
  outcome: Record<string, unknown> | null;
  isCompleted: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {prey && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Prey:</span>
            <UserAvatar user={prey} challengeId={challengeId} size="sm" showName />
          </div>
          {isCompleted && outcome?.caughtPrey !== undefined && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                outcome.caughtPrey ? "text-emerald-400" : "text-zinc-500"
              )}
            >
              {outcome.caughtPrey ? (
                <>
                  <Check className="h-3 w-3" /> Caught
                </>
              ) : (
                <>
                  <X className="h-3 w-3" /> Escaped
                </>
              )}
            </span>
          )}
        </div>
      )}
      {hunter && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Hunter:</span>
            <UserAvatar user={hunter} challengeId={challengeId} size="sm" showName />
          </div>
          {isCompleted && outcome?.wasCaught !== undefined && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                outcome.wasCaught ? "text-red-400" : "text-emerald-400"
              )}
            >
              {outcome.wasCaught ? (
                <>
                  <X className="h-3 w-3" /> Caught you
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" /> Evaded
                </>
              )}
            </span>
          )}
        </div>
      )}
      {!prey && !hunter && (
        <span className="text-xs text-zinc-500">No prey or hunter assigned</span>
      )}
    </div>
  );
}

function PrWeekResult({
  initialState,
  outcome,
  isCompleted,
}: {
  initialState: { dailyPr?: number } | null;
  outcome: Record<string, unknown> | null;
  isCompleted: boolean;
}) {
  const startingPr = initialState?.dailyPr ?? 0;

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">
        Starting PR: {startingPr} pts/day
      </span>
      {isCompleted && outcome?.hitPr !== undefined && (
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            outcome.hitPr ? "text-emerald-400" : "text-zinc-500"
          )}
        >
          {outcome.hitPr ? (
            <>
              <Trophy className="h-3 w-3" /> New PR: {outcome.weekMaxPoints} pts
            </>
          ) : (
            <>Best: {outcome.weekMaxPoints ?? 0} pts</>
          )}
        </span>
      )}
    </div>
  );
}
