'use client';

import { Trophy, Users, Zap } from 'lucide-react';

import { useChallengeRealtime } from './challenge-realtime-context';
import { UserAvatar } from '@/components/user-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActiveMiniGames } from '@/components/mini-games';
import { cn } from '@/lib/utils';

interface ChallengeSidebarProps {
  challengeId: string;
  currentUserId: string;
}

export function ChallengeSidebar({ challengeId, currentUserId }: ChallengeSidebarProps) {
  const { summary, connectionState } = useChallengeRealtime();
  const { stats, leaderboard } = summary;

  const connectionLabel =
    connectionState === 'open'
      ? 'Live updates on'
      : connectionState === 'connecting'
        ? 'Connecting to live updates…'
        : 'Reconnecting…';

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-transparent">
        <CardHeader className="flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
            <span>Status</span>
            <span
              className={cn('flex items-center gap-1', {
                'text-green-500': connectionState === 'open',
                'text-amber-500': connectionState !== 'open',
              })}
            >
              <span
                className={cn('h-2 w-2 rounded-full', {
                  'bg-green-500': connectionState === 'open',
                  'bg-amber-500': connectionState !== 'open',
                })}
              />
              {connectionLabel}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {stats.totalPoints.toFixed(0)} total points
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between text-zinc-500">
              <span>Activities</span>
              <Zap className="h-4 w-4" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{stats.totalActivities}</p>
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

      <Card className="border-zinc-800 bg-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Trophy className="h-5 w-5 text-amber-500" />
            Live Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leaderboard.length === 0 && (
            <p className="text-sm text-zinc-500">
              No participants have logged points yet.
            </p>
          )}
          {leaderboard.map((entry, index) => {
            const isCurrentUser = entry.participantId === currentUserId;
            return (
              <div
                key={entry.participantId}
                className={cn(
                  'flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition',
                  isCurrentUser && 'border-indigo-500/50 bg-indigo-500/10',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-zinc-500">
                    #{index + 1}
                  </span>
                  <UserAvatar
                    user={{
                      id: entry.user.id,
                      name: entry.user.name,
                      username: entry.user.username,
                      avatarUrl: entry.user.avatarUrl,
                    }}
                    challengeId={challengeId}
                    size="md"
                    showName
                  >
                    <p className="text-xs text-zinc-500">
                      {entry.totalPoints.toFixed(0)} pts · streak {entry.currentStreak}
                    </p>
                  </UserAvatar>
                </div>
                {isCurrentUser && (
                  <span className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white">
                    You
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
