"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Doc, Id } from "@repo/backend/_generated/dataModel";

import {
  ChallengeRealtimeProvider,
  type ChallengeSummary,
} from "@/components/dashboard/challenge-realtime-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

/** Paths that show the right sidebar (leaderboard, stats). All others hide it. */
const SHOW_RIGHT_SIDEBAR_SEGMENTS = new Set(["dashboard", "notifications"]);

interface DashboardShellProps {
  challenge: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  currentUserId: string;
  currentUser: Doc<"users">;
  initialSummary?: ChallengeSummary;
  children: ReactNode;
}

export function DashboardShell({
  challenge,
  currentUserId,
  currentUser,
  initialSummary,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean)[2] ?? "";
  const hideRightSidebar = !SHOW_RIGHT_SIDEBAR_SEGMENTS.has(segment);

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
    timestamp: "",
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
