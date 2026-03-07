"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crosshair, Flame, MapPin, Trophy } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { PointsDisplay } from "@/components/ui/points-display";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { cn } from "@/lib/utils";

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

      <UserAvatar
        user={{
          id: entry.user.id,
          name: entry.user.name,
          username: entry.user.username,
          avatarUrl: entry.user.avatarUrl,
        }}
        challengeId={challengeId}
        disableLink
        size="sm"
      />

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
              className={cn("font-mono font-bold", entry.totalPoints >= 0 && "text-white")}
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
  const followingIds = useQuery(api.queries.follows.getFollowingIds);
  const followingSet = new Set(followingIds ?? []);

  const myEntryRef = useRef<HTMLDivElement>(null);
  const [myEntryVisible, setMyEntryVisible] = useState(true);

  const myEntry = entries.find((e) => e.user.id === currentUserId);

  useEffect(() => {
    const el = myEntryRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setMyEntryVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToMe = useCallback(() => {
    myEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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
    <>
      <div className="space-y-2">
        {entries.map((entry) => {
          const isCurrentUser = entry.user.id === currentUserId;
          return (
            <div key={entry.user.id} ref={isCurrentUser ? myEntryRef : undefined}>
              <LeaderboardEntryRow
                entry={entry}
                challengeId={challengeId}
                isCurrentUser={isCurrentUser}
                isFollowing={followingSet.has(entry.user.id as Id<"users">)}
              />
            </div>
          );
        })}
      </div>

      {myEntry && !myEntryVisible && (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2">
          <button
            onClick={scrollToMe}
            className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Crosshair className="h-4 w-4" />
            #{myEntry.rank} — Find me
          </button>
        </div>
      )}
    </>
  );
}
