'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame, Loader2, Users } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';

import { useChallengeSummary } from './challenge-realtime-context';
import { UserAvatar } from '@/components/user-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActiveMiniGames } from '@/components/mini-games';
import { OnboardingCard } from './onboarding-card';
import { dateOnlyToUtcMs } from '@/lib/date-only';
import { formatPoints } from '@/lib/points';

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
      <Card className="border-zinc-800 bg-transparent">
        <CardHeader className="flex flex-col space-y-2">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Status
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {formatPoints(stats.totalPoints)} total points
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between text-zinc-500">
              <span>My streak</span>
              <Flame className="h-4 w-4" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{stats.userStreak}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between text-zinc-500">
              <span>Participants</span>
              <Users className="h-4 w-4" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{stats.totalParticipants}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="text-zinc-500">Days remaining</div>
            <p className="mt-2 text-xl font-semibold text-white">{stats.daysRemaining}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="text-zinc-500">Your rank</div>
            <p className="mt-2 text-xl font-semibold text-white">
              {stats.userRank ? `#${stats.userRank}` : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Mini-Games */}
      <ActiveMiniGames challengeId={challengeId} userId={currentUserId} />

      <SuggestedFollows challengeId={challengeId} />

      {challengeStarted && (
        <OnboardingCard challengeId={challengeId} userId={currentUserId} challengeStartDate={challengeStartDate} />
      )}
    </div>
  );
}

function affinityLabel(score: number): string {
  if (score >= 40) return 'Active in your feed';
  if (score >= 15) return "You've interacted";
  return 'In your challenge';
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
        {suggestions.map((user: { id: string; name: string | null; username: string; avatarUrl: string | null; affinityScore: number }) => (
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
  user: { id: string; name: string | null; username: string; avatarUrl: string | null; affinityScore: number };
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
        <p className="text-[10px] text-zinc-600">
          {affinityLabel(user.affinityScore)}
        </p>
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
