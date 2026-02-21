"use client";

import { useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trophy, Loader2 } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { PointsDisplay } from "@/components/ui/points-display";
import { formatPoints } from "@/lib/points";
import { cn } from "@/lib/utils";

interface WeeklyLeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  weeklyPoints: number;
}

interface CategoryLeaderboard {
  category: {
    id: string;
    name: string;
  };
  entries: WeeklyLeaderboardEntry[];
  cumulativeLeader: {
    user: {
      id: string;
      name: string | null;
      username: string;
      avatarUrl: string | null;
    };
    cumulativePoints: number;
  } | null;
}

interface WeeklyCategoryLeaderboardProps {
  challengeId: string;
  currentUserId: string;
  initialWeek?: number;
}

export function WeeklyCategoryLeaderboard({
  challengeId,
  currentUserId,
  initialWeek,
}: WeeklyCategoryLeaderboardProps) {
  const [weekNumber, setWeekNumber] = useState(initialWeek ?? 1);

  const data = useQuery(api.queries.participations.getWeeklyCategoryLeaderboard, {
    challengeId: challengeId as Id<"challenges">,
    weekNumber,
  });

  // Once we have data, if initialWeek wasn't provided, snap to current week
  const hasSnapped = useRef(false);
  if (data && !hasSnapped.current && !initialWeek) {
    hasSnapped.current = true;
    if (data.currentWeek >= 1 && data.currentWeek <= data.totalWeeks) {
      setWeekNumber(data.currentWeek);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const canGoPrev = weekNumber > 1;
  const canGoNext = weekNumber < data.totalWeeks;

  return (
    <div className="space-y-6">
      {/* Week navigator */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setWeekNumber((w) => Math.max(1, w - 1))}
          disabled={!canGoPrev}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <p className="text-lg font-semibold text-white">
            Week {data.weekNumber}
          </p>
          {data.weekNumber === data.currentWeek && (
            <p className="text-xs text-indigo-400">Current week</p>
          )}
        </div>

        <button
          onClick={() => setWeekNumber((w) => Math.min(data.totalWeeks, w + 1))}
          disabled={!canGoNext}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Category sections */}
      {data.categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="mb-4 h-12 w-12 text-zinc-600" />
          <h3 className="text-lg font-medium text-zinc-300">
            No activities this week
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            No one has logged activities for week {data.weekNumber} yet.
          </p>
        </div>
      ) : (
        (data.categories as CategoryLeaderboard[]).map((category) => (
          <div key={category.category.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {category.category.name}
              </h3>
              {category.cumulativeLeader && (
                <p className="truncate text-xs text-zinc-500">
                  Cumulative:{" "}
                  <span className="font-medium text-zinc-300">
                    {category.cumulativeLeader.user.name || category.cumulativeLeader.user.username}
                  </span>{" "}
                  ({formatPoints(category.cumulativeLeader.cumulativePoints)} pts)
                </p>
              )}
            </div>
            <div className="space-y-2">
              {category.entries.map((entry: WeeklyLeaderboardEntry) => {
                const isCurrentUser = entry.user.id === currentUserId;

                return (
                  <Link
                    key={entry.user.id}
                    href={`/challenges/${challengeId}/users/${entry.user.id}`}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-3 transition",
                      isCurrentUser
                        ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 hover:bg-indigo-500/20"
                        : "bg-zinc-900/50 hover:bg-zinc-800/50"
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center text-base font-bold text-zinc-500">
                      {entry.rank <= 3 ? (
                        <Trophy
                          className={cn(
                            "h-4 w-4",
                            entry.rank === 1 && "text-amber-500",
                            entry.rank === 2 && "text-zinc-400",
                            entry.rank === 3 && "text-amber-700"
                          )}
                        />
                      ) : (
                        entry.rank
                      )}
                    </div>

                    <UserAvatar
                      user={{
                        id: entry.user.id,
                        name: entry.user.name,
                        username: entry.user.username,
                        avatarUrl: entry.user.avatarUrl,
                      }}
                      challengeId={challengeId}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {entry.user.name || entry.user.username}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-indigo-400">
                            (You)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <PointsDisplay
                        points={entry.weeklyPoints}
                        size="sm"
                        showSign={false}
                        showLabel={false}
                        className={cn("font-bold", entry.weeklyPoints >= 0 && "text-white")}
                      />
                      <p className="text-xs text-zinc-500">pts</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
