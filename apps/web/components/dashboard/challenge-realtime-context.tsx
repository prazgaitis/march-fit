'use client';

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';

interface LeaderboardUser {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface LeaderboardEntry {
  participantId: string;
  totalPoints: number;
  currentStreak: number;
  user: LeaderboardUser;
}

export interface ChallengeStats {
  totalActivities: number;
  totalParticipants: number;
  totalPoints: number;
  daysRemaining: number;
  userRank: number | null;
  userPoints: number;
  userStreak: number;
}

export interface ChallengeSummary {
  stats: ChallengeStats;
  leaderboard: LeaderboardEntry[];
  latestActivityId: string | null;
  timestamp: string;
}

// --- Summary context (leaderboard, stats) ---
interface ChallengeSummaryContextValue {
  summary: ChallengeSummary;
  connectionState: 'connecting' | 'open' | 'error';
}

const ChallengeSummaryContext = createContext<
  ChallengeSummaryContextValue | undefined
>(undefined);

// --- Activity notification context (lightweight, changes less often) ---
interface ActivityNotificationContextValue {
  hasNewActivity: boolean;
  acknowledgeActivity: () => void;
}

const ActivityNotificationContext = createContext<
  ActivityNotificationContextValue | undefined
>(undefined);

interface ChallengeRealtimeProviderProps extends PropsWithChildren {
  challengeId: string;
  userId: string;
  initialSummary: ChallengeSummary;
}

export function ChallengeRealtimeProvider({
  challengeId,
  userId,
  initialSummary,
  children,
}: ChallengeRealtimeProviderProps) {
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [lastSeenActivityId, setLastActivityId] = useState<string | null>(
    initialSummary.latestActivityId
  );

  // Use Convex query for live updates
  const liveData = useQuery(api.queries.challenges.getDashboardData, {
    challengeId: challengeId as Id<"challenges">,
    userId: userId as Id<"users">,
  });

  const summary: ChallengeSummary = useMemo(() => {
    if (!liveData) return initialSummary;

    const { stats, leaderboard, latestActivityId } = liveData;

    const formattedLeaderboard: LeaderboardEntry[] = leaderboard.map((entry: LeaderboardEntry) => ({
      participantId: entry.participantId,
      totalPoints: entry.totalPoints,
      currentStreak: entry.currentStreak,
      user: entry.user,
    }));

    return {
        stats: {
            ...initialSummary.stats,
            ...stats,
        },
        leaderboard: formattedLeaderboard,
        latestActivityId: latestActivityId ?? null,
        timestamp: new Date().toISOString(),
    };
  }, [liveData, initialSummary]);

  useEffect(() => {
    if (
      summary.latestActivityId &&
      summary.latestActivityId !== lastSeenActivityId
    ) {
      setLastActivityId(summary.latestActivityId);
      setHasNewActivity(true);
    }
  }, [summary.latestActivityId, lastSeenActivityId]);

  const acknowledgeActivity = useCallback(() => {
    setHasNewActivity(false);
  }, []);

  // Split into two stable context values so consumers re-render independently
  const summaryValue = useMemo(
    () => ({
      summary,
      connectionState: (liveData ? 'open' : 'connecting') as 'connecting' | 'open' | 'error',
    }),
    [summary, liveData],
  );

  const notificationValue = useMemo(
    () => ({
      hasNewActivity,
      acknowledgeActivity,
    }),
    [hasNewActivity, acknowledgeActivity],
  );

  return (
    <ChallengeSummaryContext.Provider value={summaryValue}>
      <ActivityNotificationContext.Provider value={notificationValue}>
        {children}
      </ActivityNotificationContext.Provider>
    </ChallengeSummaryContext.Provider>
  );
}

/**
 * Use for components that need the full summary (leaderboard, stats).
 * Re-renders on every Convex update.
 */
export function useChallengeSummary() {
  const context = useContext(ChallengeSummaryContext);
  if (!context) {
    throw new Error(
      'useChallengeSummary must be used within a ChallengeRealtimeProvider',
    );
  }
  return context;
}

/**
 * Use for components that only need to know about new activity notifications.
 * Only re-renders when hasNewActivity changes — not on every leaderboard update.
 */
export function useActivityNotification() {
  const context = useContext(ActivityNotificationContext);
  if (!context) {
    throw new Error(
      'useActivityNotification must be used within a ChallengeRealtimeProvider',
    );
  }
  return context;
}

/**
 * @deprecated Use useChallengeSummary() or useActivityNotification() instead.
 * Kept for backward compatibility — subscribes to both contexts.
 */
export function useChallengeRealtime() {
  const { summary, connectionState } = useChallengeSummary();
  const { hasNewActivity, acknowledgeActivity } = useActivityNotification();
  return { summary, hasNewActivity, acknowledgeActivity, connectionState };
}
