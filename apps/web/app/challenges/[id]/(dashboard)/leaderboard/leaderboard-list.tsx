"use client";

import { memo } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

import { UserChallengeDisplay } from "@/components/user-challenge-display";
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
}: {
  entry: LeaderboardEntry;
  challengeId: string;
  isCurrentUser: boolean;
}) {
  return (
    <Link
      href={`/challenges/${challengeId}/users/${entry.user.id}`}
      className={cn(
        "flex items-center gap-4 rounded-xl p-4 transition",
        isCurrentUser
          ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 hover:bg-indigo-500/20"
          : "bg-zinc-900/50 hover:bg-zinc-800/50"
      )}
    >
      {getRankBadge(entry.rank)}

      <UserChallengeDisplay
        user={entry.user}
        challengeId={challengeId}
        disableLink
        size="md"
        show={{
          name: true,
          username: true,
          location: true,
          points: true,
          streak: true,
        }}
        points={entry.totalPoints}
        streak={entry.currentStreak}
        highlight={false}
        suffix={
          isCurrentUser ? (
            <span className="text-xs text-indigo-400">(You)</span>
          ) : undefined
        }
        className="flex-1"
      />
    </Link>
  );
});

export function LeaderboardList({ entries, challengeId, currentUserId }: LeaderboardListProps) {
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
      {entries.map((entry) => (
        <LeaderboardEntryRow
          key={entry.user.id}
          entry={entry}
          challengeId={challengeId}
          isCurrentUser={entry.user.id === currentUserId}
        />
      ))}
    </div>
  );
}
