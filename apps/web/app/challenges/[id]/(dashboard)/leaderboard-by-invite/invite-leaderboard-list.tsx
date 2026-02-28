"use client";

import { memo } from "react";
import Link from "next/link";
import { Send, Trophy } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface InviteLeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  inviteCount: number;
}

interface InviteLeaderboardListProps {
  entries: InviteLeaderboardEntry[];
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

const InviteLeaderboardRow = memo(function InviteLeaderboardRow({
  entry,
  challengeId,
  isCurrentUser,
}: {
  entry: InviteLeaderboardEntry;
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

      <UserAvatar
        user={{
          id: entry.user.id,
          name: entry.user.name,
          username: entry.user.username,
          avatarUrl: entry.user.avatarUrl,
        }}
        challengeId={challengeId}
        disableLink
        size="md"
      />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">
          {entry.user.name || entry.user.username}
          {isCurrentUser && (
            <span className="ml-2 text-xs text-indigo-400">(You)</span>
          )}
        </p>
        <p className="text-sm text-zinc-500">@{entry.user.username}</p>
      </div>

      <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1">
        <Send className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-500">
          {entry.inviteCount}
        </span>
      </div>
    </Link>
  );
});

export function InviteLeaderboardList({
  entries,
  challengeId,
  currentUserId,
}: InviteLeaderboardListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Send className="mb-4 h-12 w-12 text-zinc-600" />
        <h3 className="text-lg font-medium text-zinc-300">
          No invites yet
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Share your invite link to get on the board!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <InviteLeaderboardRow
          key={entry.user.id}
          entry={entry}
          challengeId={challengeId}
          isCurrentUser={entry.user.id === currentUserId}
        />
      ))}
    </div>
  );
}
