"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Check,
  Play,
  Square,
  Target,
  Trash2,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type MiniGameType = "partner_week" | "hunt_week" | "pr_week";
type MiniGameStatus = "draft" | "active" | "calculating" | "completed";

type MiniGameParticipant = {
  id: string;
  initialState: {
    rank?: number;
    points?: number;
    dailyPr?: number;
  };
  outcome: {
    partnerWeekPoints?: number;
    caughtPrey?: boolean;
    wasCaught?: boolean;
    weekMaxPoints?: number;
    hitPr?: boolean;
  } | null;
  bonusPoints?: number;
  user?: { name?: string; username: string; avatarUrl?: string };
  partnerUser?: { name?: string; username: string; avatarUrl?: string };
  preyUser?: { name?: string; username: string; avatarUrl?: string };
  hunterUser?: { name?: string; username: string; avatarUrl?: string };
};

const gameTypeInfo: Record<
  MiniGameType,
  { label: string; icon: typeof Users; description: string }
> = {
  partner_week: {
    label: "Partner Week",
    icon: Users,
    description: "Players paired by rank, earn % of partner's points",
  },
  hunt_week: {
    label: "Hunt Week",
    icon: Target,
    description: "Hunt the player above you, avoid being caught",
  },
  pr_week: {
    label: "PR Week",
    icon: Zap,
    description: "Beat your daily point PR for a bonus",
  },
};

const statusStyles: Record<MiniGameStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-zinc-700 text-zinc-300" },
  active: { label: "Active", className: "bg-emerald-500/20 text-emerald-400" },
  calculating: { label: "Calculating", className: "bg-amber-500/20 text-amber-400" },
  completed: { label: "Completed", className: "bg-blue-500/20 text-blue-400" },
};

export default function MiniGameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;
  const gameId = params.gameId as string;

  const miniGame = useQuery(api.queries.miniGames.getById, {
    miniGameId: gameId as Id<"miniGames">,
  });

  const startMiniGame = useMutation(api.mutations.miniGames.start);
  const endMiniGame = useMutation(api.mutations.miniGames.end);
  const deleteMiniGame = useMutation(api.mutations.miniGames.remove);

  const handleStart = async () => {
    try {
      await startMiniGame({ miniGameId: gameId as Id<"miniGames"> });
    } catch (error) {
      console.error("Failed to start mini-game:", error);
      alert(error instanceof Error ? error.message : "Failed to start mini-game");
    }
  };

  const handleEnd = async () => {
    try {
      await endMiniGame({ miniGameId: gameId as Id<"miniGames"> });
    } catch (error) {
      console.error("Failed to end mini-game:", error);
      alert(error instanceof Error ? error.message : "Failed to end mini-game");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMiniGame({ miniGameId: gameId as Id<"miniGames"> });
      router.push(`/challenges/${challengeId}/admin/mini-games`);
    } catch (error) {
      console.error("Failed to delete mini-game:", error);
      alert(error instanceof Error ? error.message : "Failed to delete mini-game");
    }
  };

  if (!miniGame) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  const typeInfo = gameTypeInfo[miniGame.type as MiniGameType];
  const status = statusStyles[miniGame.status as MiniGameStatus];
  const Icon = typeInfo.icon;
  const config = miniGame.config as Record<string, number> | undefined;

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={() => router.push(`/challenges/${challengeId}/admin/mini-games`)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Mini-Games
      </button>

      {/* Header */}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800">
              <Icon className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-zinc-100">
                  {miniGame.name}
                </h1>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    status.className
                  )}
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-500">{typeInfo.label}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {miniGame.status === "draft" && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-100">
                        Delete Mini-Game?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will permanently delete &quot;{miniGame.name}&quot;. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-500 text-white hover:bg-red-600"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-500 text-white hover:bg-emerald-400"
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Start Game
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-100">
                        Start Mini-Game?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will capture the current leaderboard and create pairings/assignments
                        for all participants. Once started, the game cannot be edited.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleStart}
                        className="bg-emerald-500 text-white hover:bg-emerald-400"
                      >
                        Start Game
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {miniGame.status === "active" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="h-8 bg-amber-500 text-black hover:bg-amber-400"
                  >
                    <Square className="mr-1 h-3 w-3" />
                    End Game
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-zinc-100">
                      End Mini-Game?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This will calculate outcomes and award bonus points to all
                      participants. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleEnd}
                      className="bg-amber-500 text-black hover:bg-amber-400"
                    >
                      End Game
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-400">Period:</span>
            <span className="text-zinc-200">
              {format(new Date(miniGame.startsAt), "MMM d")} -{" "}
              {format(new Date(miniGame.endsAt), "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-400">Participants:</span>
            <span className="text-zinc-200">{miniGame.participants.length}</span>
          </div>
          {config && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-zinc-500" />
              <span className="text-zinc-400">Config:</span>
              <span className="text-zinc-200">
                {miniGame.type === "partner_week" &&
                  `${config.bonusPercentage ?? 10}% of partner points`}
                {miniGame.type === "hunt_week" &&
                  `+${config.catchBonus ?? 75} catch / -${config.caughtPenalty ?? 25} caught`}
                {miniGame.type === "pr_week" && `+${config.prBonus ?? 100} for PR`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Participants Table */}
      {miniGame.participants.length > 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Participants
            </span>
          </div>

          {/* Table Header */}
          <div
            className={cn(
              "grid gap-2 border-b border-zinc-800 px-3 py-2",
              miniGame.type === "partner_week" && "grid-cols-12",
              miniGame.type === "hunt_week" && "grid-cols-12",
              miniGame.type === "pr_week" && "grid-cols-10"
            )}
          >
            <div className="col-span-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              #
            </div>
            <div className="col-span-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Participant
            </div>
            {miniGame.type === "partner_week" && (
              <>
                <div className="col-span-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Partner
                </div>
                <div className="col-span-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Partner Pts
                </div>
              </>
            )}
            {miniGame.type === "hunt_week" && (
              <>
                <div className="col-span-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Prey
                </div>
                <div className="col-span-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Hunter
                </div>
                <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Result
                </div>
              </>
            )}
            {miniGame.type === "pr_week" && (
              <>
                <div className="col-span-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Starting PR
                </div>
                <div className="col-span-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Week Max
                </div>
              </>
            )}
            <div className="col-span-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Bonus
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-zinc-800/50">
            {miniGame.participants.map((participant: MiniGameParticipant) => {
              const initialState = participant.initialState;
              const outcome = participant.outcome;

              return (
                <div
                  key={participant.id}
                  className={cn(
                    "grid items-center gap-2 px-3 py-2",
                    miniGame.type === "partner_week" && "grid-cols-12",
                    miniGame.type === "hunt_week" && "grid-cols-12",
                    miniGame.type === "pr_week" && "grid-cols-10"
                  )}
                >
                  {/* Rank */}
                  <div className="col-span-1">
                    <span className="font-mono text-xs text-zinc-600">
                      {initialState?.rank ?? "-"}
                    </span>
                  </div>

                  {/* Participant */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
                      {participant.user?.avatarUrl ? (
                        <img
                          src={participant.user.avatarUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-3 w-3 text-zinc-500" />
                      )}
                    </div>
                    <span className="truncate text-sm text-zinc-200">
                      {participant.user?.name || participant.user?.username}
                    </span>
                  </div>

                  {/* Partner Week columns */}
                  {miniGame.type === "partner_week" && (
                    <>
                      <div className="col-span-3 flex items-center gap-2">
                        {participant.partnerUser ? (
                          <>
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
                              {participant.partnerUser.avatarUrl ? (
                                <img
                                  src={participant.partnerUser.avatarUrl}
                                  alt=""
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-3 w-3 text-zinc-500" />
                              )}
                            </div>
                            <span className="truncate text-sm text-zinc-400">
                              {participant.partnerUser.name ||
                                participant.partnerUser.username}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600">-</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        {outcome?.partnerWeekPoints !== undefined ? (
                          <span className="font-mono text-sm text-zinc-300">
                            {outcome.partnerWeekPoints}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">-</span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Hunt Week columns */}
                  {miniGame.type === "hunt_week" && (
                    <>
                      <div className="col-span-2 flex items-center gap-1">
                        {participant.preyUser ? (
                          <>
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800">
                              {participant.preyUser.avatarUrl ? (
                                <img
                                  src={participant.preyUser.avatarUrl}
                                  alt=""
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-2.5 w-2.5 text-zinc-500" />
                              )}
                            </div>
                            <span className="truncate text-xs text-zinc-400">
                              {participant.preyUser.name ||
                                participant.preyUser.username}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600">None (1st)</span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        {participant.hunterUser ? (
                          <>
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800">
                              {participant.hunterUser.avatarUrl ? (
                                <img
                                  src={participant.hunterUser.avatarUrl}
                                  alt=""
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-2.5 w-2.5 text-zinc-500" />
                              )}
                            </div>
                            <span className="truncate text-xs text-zinc-400">
                              {participant.hunterUser.name ||
                                participant.hunterUser.username}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600">None (last)</span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        {outcome ? (
                          <>
                            {outcome.caughtPrey !== undefined && (
                              <div
                                className={cn(
                                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                                  outcome.caughtPrey
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-zinc-800 text-zinc-500"
                                )}
                              >
                                {outcome.caughtPrey ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                Caught
                              </div>
                            )}
                            {outcome.wasCaught !== undefined && (
                              <div
                                className={cn(
                                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                                  outcome.wasCaught
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-zinc-800 text-zinc-500"
                                )}
                              >
                                {outcome.wasCaught ? (
                                  <X className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Hunted
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600">-</span>
                        )}
                      </div>
                    </>
                  )}

                  {/* PR Week columns */}
                  {miniGame.type === "pr_week" && (
                    <>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-sm text-zinc-400">
                          {initialState?.dailyPr ?? 0}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        {outcome?.weekMaxPoints !== undefined ? (
                          <span
                            className={cn(
                              "font-mono text-sm",
                              outcome.hitPr ? "text-emerald-400" : "text-zinc-400"
                            )}
                          >
                            {outcome.weekMaxPoints}
                            {outcome.hitPr && " PR!"}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">-</span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Bonus */}
                  <div className="col-span-2 text-right">
                    {participant.bonusPoints !== undefined &&
                    participant.bonusPoints !== null ? (
                      <span
                        className={cn(
                          "font-mono text-sm font-medium",
                          participant.bonusPoints > 0
                            ? "text-emerald-400"
                            : participant.bonusPoints < 0
                              ? "text-red-400"
                              : "text-zinc-500"
                        )}
                      >
                        {participant.bonusPoints > 0 ? "+" : ""}
                        {participant.bonusPoints}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Footer */}
          {miniGame.status === "completed" && (
            <div className="border-t border-zinc-800 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Total Bonus Points Awarded</span>
                <span className="font-mono font-medium text-emerald-400">
                  {miniGame.participants.reduce(
                    (sum: number, p: MiniGameParticipant) => sum + (p.bonusPoints ?? 0),
                    0
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-zinc-600" />
          <div className="mt-2 text-sm text-zinc-400">No participants yet</div>
          <div className="mt-1 text-xs text-zinc-600">
            {miniGame.status === "draft"
              ? "Participants will be assigned when you start the game"
              : "No participants were assigned to this game"}
          </div>
        </div>
      )}
    </div>
  );
}
