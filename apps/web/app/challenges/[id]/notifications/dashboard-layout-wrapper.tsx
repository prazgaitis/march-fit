"use client";

import { ReactNode } from "react";
import type { Doc, Id } from "@repo/backend/_generated/dataModel";

import {
  ChallengeRealtimeProvider,
  type ChallengeSummary,
} from "@/components/dashboard/challenge-realtime-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

interface DashboardLayoutWrapperProps {
  challenge: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  currentUserId: string;
  currentUser: Doc<"users">;
  children: ReactNode;
  hideRightSidebar?: boolean;
  initialSummary?: ChallengeSummary;
}

export function DashboardLayoutWrapper({
  challenge,
  currentUserId,
  currentUser,
  children,
  hideRightSidebar,
  initialSummary,
}: DashboardLayoutWrapperProps) {
  // Use provided summary or create a minimal one for the realtime provider
  const summary: ChallengeSummary = initialSummary ?? {
    stats: {
      totalActivities: 0,
      totalParticipants: 0,
      totalPoints: 0,
      daysRemaining: 0,
      userRank: null,
      userPoints: 0,
      userStreak: 0,
    },
    leaderboard: [],
    latestActivityId: null,
    timestamp: new Date().toISOString(),
  };

  return (
    <ChallengeRealtimeProvider
      challengeId={challenge.id as Id<"challenges">}
      userId={currentUserId as Id<"users">}
      initialSummary={summary}
    >
      <DashboardLayout
        challenge={challenge}
        currentUserId={currentUserId}
        currentUser={currentUser}
        hideRightSidebar={hideRightSidebar}
      >
        {children}
      </DashboardLayout>
    </ChallengeRealtimeProvider>
  );
}
