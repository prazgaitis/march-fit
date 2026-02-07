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

interface ChallengeRealtimeContextValue {
  summary: ChallengeSummary;
  hasNewActivity: boolean;
  acknowledgeActivity: () => void;
  connectionState: 'connecting' | 'open' | 'error';
}

const ChallengeRealtimeContext = createContext<
  ChallengeRealtimeContextValue | undefined
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
    
    // Convert Convex leaderboard shape to frontend shape if needed
    // The query returns exactly what we need based on previous inspection
    const formattedLeaderboard: LeaderboardEntry[] = leaderboard.map((entry: LeaderboardEntry) => ({
      participantId: entry.participantId,
      totalPoints: entry.totalPoints,
      currentStreak: entry.currentStreak,
      user: entry.user,
    }));

    // Calculate days remaining locally or use server value
    // The server query returns daysRemaining in stats
    
    return {
        stats: {
            // Merge initial stats as fallback/base, then override with live stats
            // Note: daysRemaining is calculated in the Page component, not in the query,
            // so we rely on initialSummary.stats.daysRemaining
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

  const value = useMemo(
    () => ({
      summary,
      hasNewActivity,
      acknowledgeActivity,
      connectionState: (liveData ? 'open' : 'connecting') as 'connecting' | 'open' | 'error',
    }),
    [summary, hasNewActivity, acknowledgeActivity, liveData],
  );

  return (
    <ChallengeRealtimeContext.Provider value={value}>
      {children}
    </ChallengeRealtimeContext.Provider>
  );
}

export function useChallengeRealtime() {
  const context = useContext(ChallengeRealtimeContext);
  if (!context) {
    throw new Error(
      'useChallengeRealtime must be used within a ChallengeRealtimeProvider',
    );
  }
  return context;
}
