'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';

import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

function affinityLabel(score: number, location: string | null): string {
  if (score >= 40) return 'Active in your feed';
  if (score >= 15) return "You've interacted";
  if (location) return location;
  return '';
}

interface SuggestedFollowsProps {
  challengeId: string;
  /** "compact" for sidebar, "feed" for inline feed injection */
  variant?: "compact" | "feed";
}

export function SuggestedFollows({ challengeId, variant = "compact" }: SuggestedFollowsProps) {
  const suggestions = useQuery(api.queries.follows.getSuggestions, {
    challengeId: challengeId as Id<"challenges">,
    limit: 5,
  });

  if (!suggestions || suggestions.length === 0) return null;

  const isFeed = variant === "feed";

  return (
    <div className={isFeed ? "rounded-lg border border-zinc-800 p-4" : undefined}>
      <div className={cn("flex items-center justify-between", isFeed ? "mb-4" : "mb-3")}>
        <h3 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          People to watch
        </h3>
      </div>
      <div className={isFeed ? "space-y-2" : "space-y-1.5"}>
        {suggestions.map((user: { id: string; name: string | null; username: string; avatarUrl: string | null; location: string | null; affinityScore: number }) => (
          <SuggestionRow
            key={user.id}
            user={user}
            challengeId={challengeId}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionRow({
  user,
  challengeId,
  variant = "compact",
}: {
  user: { id: string; name: string | null; username: string; avatarUrl: string | null; location: string | null; affinityScore: number };
  challengeId: string;
  variant?: "compact" | "feed";
}) {
  const isFeed = variant === "feed";
  const [isToggling, setIsToggling] = useState(false);
  const toggleFollow = useMutation(api.mutations.follows.toggle);

  const handleFollow = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isToggling) return;
      setIsToggling(true);
      try {
        await toggleFollow({ userId: user.id as Id<"users"> });
      } catch (error) {
        console.error("Failed to follow:", error);
      } finally {
        setIsToggling(false);
      }
    },
    [isToggling, toggleFollow, user.id],
  );

  return (
    <div className={cn(
      "group flex items-center gap-3 rounded-lg transition-colors hover:bg-zinc-900/60",
      isFeed ? "p-2.5" : "p-2",
    )}>
      <UserAvatar
        user={{
          id: user.id,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
        }}
        challengeId={challengeId}
        size={isFeed ? "lg" : "md"}
        showName
        showUsername
      >
        {affinityLabel(user.affinityScore, user.location) && (
          <p className={cn(isFeed ? "text-xs" : "text-[10px]", "text-zinc-600")}>
            {affinityLabel(user.affinityScore, user.location)}
          </p>
        )}
      </UserAvatar>
      <button
        onClick={handleFollow}
        disabled={isToggling}
        className={cn(
          "ml-auto shrink-0 rounded-full border border-indigo-500/60 font-semibold text-indigo-400 transition-all hover:bg-indigo-500 hover:text-white active:scale-95 disabled:opacity-50",
          isFeed ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs",
        )}
      >
        {isToggling ? (
          <Loader2 className={cn(isFeed ? "h-4 w-4" : "h-3 w-3", "animate-spin")} />
        ) : (
          'Follow'
        )}
      </button>
    </div>
  );
}
