import { notFound, redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { type ChallengeSummary } from "@/components/dashboard/challenge-realtime-context";
import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../notifications/dashboard-layout-wrapper";
import { dateOnlyToUtcMs } from "@/lib/date-only";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const DAY_IN_MS = 1000 * 60 * 60 * 24;

interface ChallengeDashboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallengeDashboardPage({
  params,
}: ChallengeDashboardPageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      // User is signed in but Convex record couldn't be resolved.
      // Redirect to challenge page instead of sign-in to avoid a redirect loop.
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/dashboard`);
  }

  const challengeId = id as Id<"challenges">;

  const dashboardData = await convex.query(api.queries.challenges.getDashboardData, {
    challengeId,
    userId: user._id,
  });

  if (!dashboardData) {
    notFound();
  }

  const { challenge, participation, leaderboard, stats, latestActivityId } =
    dashboardData;

  const canAccess =
    user.role === "admin" ||
    challenge.creatorId === user._id ||
    Boolean(participation);

  if (!canAccess) {
    redirect(`/challenges/${challenge.id}`);
  }

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((dateOnlyToUtcMs(challenge.endDate) - now.getTime()) / DAY_IN_MS),
  );
  const initialSummary: ChallengeSummary = {
    stats: {
      ...stats,
      daysRemaining,
    },
    leaderboard: leaderboard.map((entry: (typeof leaderboard)[number]) => ({
      participantId: entry.participantId,
      totalPoints: entry.totalPoints,
      currentStreak: entry.currentStreak,
      user: entry.user,
    })),
    latestActivityId: latestActivityId ?? null,
    timestamp: new Date().toISOString(),
  };

  return (
    <DashboardLayoutWrapper
      challenge={{
        id: challenge.id,
        name: challenge.name,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }}
      currentUserId={user._id}
      currentUser={user}
      initialSummary={initialSummary}
    >
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <OnboardingCard challengeId={challenge.id} userId={user._id} />
        <ActivityFeed challengeId={challenge.id} />
      </div>
    </DashboardLayoutWrapper>
  );
}
