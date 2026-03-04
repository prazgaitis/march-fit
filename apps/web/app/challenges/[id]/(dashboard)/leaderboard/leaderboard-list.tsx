"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Flame, Loader2, MapPin, Trophy, UserCheck, UserPlus } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { PointsDisplay } from "@/components/ui/points-display";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 50;

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
    location?: string | null;
  };
  totalPoints: number;
  currentStreak: number;
}

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  challengeId: string;
  currentUserId: string;
}

function getRankBadge(rank: number) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
        <Trophy className="h-4 w-4 text-amber-500" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-400/20">
        <Trophy className="h-4 w-4 text-zinc-400" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700/20">
        <Trophy className="h-4 w-4 text-amber-700" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center text-lg font-bold text-zinc-500">
      {rank}
    </div>
  );
}

const FollowButton = memo(function FollowButton({
  userId,
  isFollowing,
}: {
  userId: string;
  isFollowing: boolean;
}) {
  const [isToggling, setIsToggling] = useState(false);
  const toggleFollow = useMutation(api.mutations.follows.toggle);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isToggling) return;
      setIsToggling(true);
      try {
        await toggleFollow({ userId: userId as Id<"users"> });
      } catch (error) {
        console.error("Failed to toggle follow:", error);
      } finally {
        setIsToggling(false);
      }
    },
    [isToggling, toggleFollow, userId],
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={handleClick}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : isFollowing ? (
        <UserCheck className="h-4 w-4 text-blue-400" />
      ) : (
        <UserPlus className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
});

const LeaderboardEntryRow = memo(function LeaderboardEntryRow({
  entry,
  challengeId,
  isCurrentUser,
  isFollowing,
}: {
  entry: LeaderboardEntry;
  challengeId: string;
  isCurrentUser: boolean;
  isFollowing: boolean;
}) {
  return (
    <Link
      href={`/challenges/${challengeId}/users/${entry.user.id}`}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl p-3 transition sm:gap-4 sm:p-4",
        isCurrentUser
          ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 hover:bg-indigo-500/20"
          : "bg-zinc-900/50 hover:bg-zinc-800/50"
      )}
    >
      {getRankBadge(entry.rank)}

      <div className="min-w-0 flex-1">
        {/* Top row: name + points + follow */}
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-white">
            {entry.user.name || entry.user.username}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <PointsDisplay
              points={entry.totalPoints}
              size="lg"
              showSign={false}
              showLabel={false}
              className={cn("font-bold", entry.totalPoints >= 0 && "text-white")}
            />
            {!isCurrentUser && (
              <FollowButton userId={entry.user.id} isFollowing={isFollowing} />
            )}
          </div>
        </div>
        {/* Bottom row: username, location, streak, (You) */}
        <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {entry.user.location ? (
            <span className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {entry.user.location}
            </span>
          ) : (
            <span>@{entry.user.username}</span>
          )}
          {entry.currentStreak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
              <Flame className="h-3 w-3" />
              {entry.currentStreak}
            </span>
          )}
          {isCurrentUser && (
            <span className="text-xs text-indigo-400">(You)</span>
          )}
        </div>
      </div>
    </Link>
  );
});

export function LeaderboardList({ entries, challengeId, currentUserId }: LeaderboardListProps) {
  const [showAll, setShowAll] = useState(false);
  const followingIds = useQuery(api.queries.follows.getFollowingIds);

  // Memoize the Set to avoid recreating it on every render
  const followingSet = useMemo(
    () => new Set(followingIds ?? []),
    [followingIds],
  );

  // Limit initial render to INITIAL_VISIBLE rows to avoid mobile scroll jank
  // on large challenges. Always include the current user's row so they can
  // see their own rank even if they're outside the top N.
  const visibleEntries = useMemo(() => {
    if (showAll || entries.length <= INITIAL_VISIBLE) return entries;

    const top = entries.slice(0, INITIAL_VISIBLE);
    const currentUserInTop = top.some((e) => e.user.id === currentUserId);
    if (currentUserInTop) return top;

    const currentUserEntry = entries.find((e) => e.user.id === currentUserId);
    return currentUserEntry ? [...top, currentUserEntry] : top;
  }, [entries, showAll, currentUserId]);

  const hiddenCount = entries.length - INITIAL_VISIBLE;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="mb-4 h-12 w-12 text-zinc-600" />
        <h3 className="text-lg font-medium text-zinc-300">No participants yet</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Be the first to log an activity and claim the top spot!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleEntries.map((entry) => (
        <LeaderboardEntryRow
          key={entry.user.id}
          entry={entry}
          challengeId={challengeId}
          isCurrentUser={entry.user.id === currentUserId}
          isFollowing={followingSet.has(entry.user.id as Id<"users">)}
        />
      ))}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 py-3 text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-200"
        >
          <ChevronDown className="h-4 w-4" />
          Show all {entries.length} participants
        </button>
      )}
    </div>
  );
}
