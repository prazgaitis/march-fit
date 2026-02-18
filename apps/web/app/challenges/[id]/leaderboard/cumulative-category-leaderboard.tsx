"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import Link from "next/link";
import { Trophy, Loader2 } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface CumulativeEntry {
  rank: number;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
    gender: string | null;
  };
  totalPoints: number;
}

interface CategoryData {
  category: { id: string; name: string };
  women: CumulativeEntry[];
  men: CumulativeEntry[];
  noGender: CumulativeEntry[];
}

interface CumulativeCategoryLeaderboardProps {
  challengeId: string;
  currentUserId: string;
}

function EntryRow({
  entry,
  challengeId,
  currentUserId,
}: {
  entry: CumulativeEntry;
  challengeId: string;
  currentUserId: string;
}) {
  const isCurrentUser = entry.user.id === currentUserId;

  return (
    <Link
      href={`/challenges/${challengeId}/users/${entry.user.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl p-3 transition",
        isCurrentUser
          ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 hover:bg-indigo-500/20"
          : "bg-zinc-900/50 hover:bg-zinc-800/50"
      )}
    >
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-base font-bold text-zinc-500">
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
            <span className="ml-2 text-xs text-indigo-400">(You)</span>
          )}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold text-white">
          {entry.totalPoints.toFixed(0)}
        </p>
        <p className="text-xs text-zinc-500">pts</p>
      </div>
    </Link>
  );
}

function GenderColumn({
  label,
  symbol,
  symbolClass,
  entries,
  challengeId,
  currentUserId,
}: {
  label: string;
  symbol: string;
  symbolClass: string;
  entries: CumulativeEntry[];
  challengeId: string;
  currentUserId: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn("text-sm font-bold", symbolClass)}>{symbol}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl bg-zinc-900/30 py-6 text-xs text-zinc-600">
          No entries
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryRow
              key={entry.user.id}
              entry={entry}
              challengeId={challengeId}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CumulativeCategoryLeaderboard({
  challengeId,
  currentUserId,
}: CumulativeCategoryLeaderboardProps) {
  const data = useQuery(api.queries.participations.getCumulativeCategoryLeaderboard, {
    challengeId: challengeId as Id<"challenges">,
  });

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (data.categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="mb-4 h-12 w-12 text-zinc-600" />
        <h3 className="text-lg font-medium text-zinc-300">No activities yet</h3>
        <p className="mt-1 text-sm text-zinc-500">
          No one has logged activities yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(data.categories as CategoryData[]).map((category) => (
        <div key={category.category.id}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            {category.category.name}
          </h3>

          {/* Two-column layout: Women | Men */}
          <div className="flex gap-4">
            <GenderColumn
              label="Women"
              symbol="♀"
              symbolClass="text-pink-400"
              entries={category.women}
              challengeId={challengeId}
              currentUserId={currentUserId}
            />
            <GenderColumn
              label="Men"
              symbol="♂"
              symbolClass="text-blue-400"
              entries={category.men}
              challengeId={challengeId}
              currentUserId={currentUserId}
            />
          </div>

          {/* Optional "Other" gender section */}
          {category.noGender.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
                Other
              </p>
              <div className="space-y-2">
                {category.noGender.map((entry) => (
                  <EntryRow
                    key={entry.user.id}
                    entry={entry}
                    challengeId={challengeId}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
