"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { useChallengeRealtime } from "./challenge-realtime-context";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";

interface UserSearchProps {
  challengeId: string;
}

export function UserSearch({ challengeId }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const { summary } = useChallengeRealtime();

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    return summary.leaderboard.filter(
      (entry) =>
        entry.user.name?.toLowerCase().includes(lowerQuery) ||
        entry.user.username?.toLowerCase().includes(lowerQuery)
    );
  }, [query, summary.leaderboard]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 rounded-full bg-zinc-900 pl-10 pr-4 text-sm placeholder:text-zinc-500 focus-visible:ring-zinc-700"
        />
      </div>

      {query.trim() && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl">
          {filteredUsers.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No users found
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredUsers.map((entry) => (
                <li key={entry.participantId}>
                  <Link
                    href={`/challenges/${challengeId}/users/${entry.participantId}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-zinc-800"
                    onClick={() => setQuery("")}
                  >
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
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium text-white">
                        {entry.user.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{entry.user.username} · {entry.totalPoints.toFixed(0)} pts
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
