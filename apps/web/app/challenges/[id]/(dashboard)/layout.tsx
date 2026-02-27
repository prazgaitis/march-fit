import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { type ChallengeSummary } from "@/components/dashboard/challenge-realtime-context";
import { DashboardShell } from "./dashboard-shell";
import { dateOnlyToUtcMs } from "@/lib/date-only";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/dashboard`);
  }

  const challengeId = id as Id<"challenges">;

  const [challenge, participation, dashboardData] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getByUserAndChallenge, {
      userId: user._id,
      challengeId,
    }),
    convex.query(api.queries.challenges.getDashboardData, {
      challengeId,
      userId: user._id,
    }),
  ]);

  if (!challenge) {
    notFound();
  }

  const canAccess =
    user.role === "admin" ||
    challenge.creatorId === user._id ||
    Boolean(participation);

  if (!canAccess) {
    redirect(`/challenges/${id}`);
  }

  const now = Date.now();
  const daysRemaining = Math.max(
    0,
    Math.ceil((dateOnlyToUtcMs(challenge.endDate) - now) / DAY_IN_MS),
  );

  const initialSummary: ChallengeSummary | undefined = dashboardData
    ? {
        stats: {
          ...dashboardData.stats,
          daysRemaining,
        },
        leaderboard: dashboardData.leaderboard.map((entry: (typeof dashboardData.leaderboard)[number]) => ({
          participantId: entry.participantId,
          totalPoints: entry.totalPoints,
          currentStreak: entry.currentStreak,
          user: entry.user,
        })),
        latestActivityId: dashboardData.latestActivityId ?? null,
        timestamp: "",
      }
    : undefined;

  return (
    <DashboardShell
      challenge={{
        id: challenge._id,
        name: challenge.name,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }}
      currentUserId={user._id}
      currentUser={user}
      initialSummary={initialSummary}
    >
      {children}
    </DashboardShell>
  );
}
