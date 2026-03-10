'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Flame, Loader2, Trophy, Users } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';

import { useChallengeSummary } from './challenge-realtime-context';
import { UserAvatar } from '@/components/user-avatar';
import { ActiveMiniGames } from '@/components/mini-games';
import { OnboardingCard } from './onboarding-card';
import { dateOnlyToUtcMs } from '@/lib/date-only';
import { formatPointsCompact } from '@/lib/points';

interface ChallengeSidebarProps {
  challengeId: string;
  currentUserId: string;
  challengeStartDate: string;
}

export function ChallengeSidebar({ challengeId, currentUserId, challengeStartDate }: ChallengeSidebarProps) {
  const { summary } = useChallengeSummary();
  const { stats } = summary;

  // Compute client-side only to avoid hydration mismatch (Date.now() differs server vs client)
  const [challengeStarted, setChallengeStarted] = useState(false);
  useEffect(() => {
    setChallengeStarted(dateOnlyToUtcMs(challengeStartDate) <= Date.now());
  }, [challengeStartDate]);

  return (
    <div className="space-y-4">
      <SuggestedFollows challengeId={challengeId} />

      <div>
        <div className="mb-4">
          <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Your points
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-white">
              {formatPointsCompact(stats.userPoints)}
            </span>
            {stats.totalParticipants > 0 && (() => {
              const avg = stats.totalPoints / stats.totalParticipants;
              const delta = stats.userPoints - avg;
              const isAbove = delta >= 0;
              return (
                <span className={`font-mono text-xs ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                  {isAbove ? '+' : ''}{formatPointsCompact(delta)} vs avg
                </span>
              );
            })()}
          </div>
        </div>

        {/* Streak & Rank — hero stats */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-orange-400/70">
              <Flame className="h-3.5 w-3.5" />
              Streak
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-orange-400">
              {stats.userStreak}
            </p>
          </div>
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-indigo-400/70">
              <Trophy className="h-3.5 w-3.5" />
              Rank
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-indigo-400">
              {stats.userRank ? `#${stats.userRank}` : '—'}
            </p>
          </div>
        </div>

        {/* Secondary stats — dimmer, smaller */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <Users className="h-3.5 w-3.5 text-zinc-600" />
            <div>
              <span className="font-mono text-sm font-semibold text-zinc-300">{stats.totalParticipants}</span>
              <span className="ml-1.5 text-xs text-zinc-600">players</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <Calendar className="h-3.5 w-3.5 text-zinc-600" />
            <div>
              <span className="font-mono text-sm font-semibold text-zinc-300">{stats.daysRemaining}</span>
              <span className="ml-1.5 text-xs text-zinc-600">days left</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Mini-Games */}
      <ActiveMiniGames challengeId={challengeId} userId={currentUserId} />

      {challengeStarted && (
        <OnboardingCard challengeId={challengeId} userId={currentUserId} challengeStartDate={challengeStartDate} />
      )}
    </div>
  );
}

function affinityLabel(score: number, location: string | null): string {
  if (score >= 40) return 'Active in your feed';
  if (score >= 15) return "You've interacted";
  if (location) return location;
  return '';
}

function SuggestedFollows({ challengeId }: { challengeId: string }) {
  const suggestions = useQuery(api.queries.follows.getSuggestions, {
    challengeId: challengeId as Id<"challenges">,
    limit: 5,
  });

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          People to watch
        </h3>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((user: { id: string; name: string | null; username: string; avatarUrl: string | null; location: string | null; affinityScore: number }) => (
          <SuggestionRow
            key={user.id}
            user={user}
            challengeId={challengeId}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionRow({
  user,
  challengeId,
}: {
  user: { id: string; name: string | null; username: string; avatarUrl: string | null; location: string | null; affinityScore: number };
  challengeId: string;
}) {
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
    <div className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-900/60">
      <UserAvatar
        user={{
          id: user.id,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
        }}
        challengeId={challengeId}
        size="md"
        showName
        showUsername
      >
        {affinityLabel(user.affinityScore, user.location) && (
          <p className="text-[10px] text-zinc-600">
            {affinityLabel(user.affinityScore, user.location)}
          </p>
        )}
      </UserAvatar>
      <button
        onClick={handleFollow}
        disabled={isToggling}
        className="ml-auto shrink-0 rounded-full border border-indigo-500/60 px-3 py-1 text-xs font-semibold text-indigo-400 transition-all hover:bg-indigo-500 hover:text-white active:scale-95 disabled:opacity-50"
      >
        {isToggling ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          'Follow'
        )}
      </button>
    </div>
  );
}
