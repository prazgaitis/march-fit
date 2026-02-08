"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";

interface ParticipantsListProps {
  challengeId: string;
}

export function ParticipantsList({ challengeId }: ParticipantsListProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.queries.participations.getChallengeParticipants,
    { challengeId: challengeId as Id<"challenges"> },
    { initialNumItems: 20 }
  );

  return (
    <div className="space-y-4">
      {results.length === 0 && status === "done" ? (
        <p className="text-sm text-muted-foreground">No participants yet.</p>
      ) : (
        <div className="space-y-3">
          {results.map((entry) => (
            <div
              key={entry.user.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <UserAvatar
                user={entry.user}
                challengeId={challengeId}
                size="md"
                showName
                showUsername
                className="p-0"
              >
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                  <span>{entry.stats.totalPoints} pts</span>
                  <span>{entry.stats.currentStreak} day streak</span>
                </div>
              </UserAvatar>
            </div>
          ))}
        </div>
      )}

      {status === "canLoadMore" && (
        <div className="pt-2">
          <Button variant="secondary" onClick={() => loadMore(20)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
