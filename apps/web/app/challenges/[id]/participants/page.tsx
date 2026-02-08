import { notFound, redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { PageContainer } from "@/components/ui/page-container";
import { DashboardLayoutWrapper } from "../notifications/dashboard-layout-wrapper";
import { ParticipantsList } from "./participants-list";
import type { ChallengeSummary } from "@/components/dashboard/challenge-realtime-context";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const DAY_IN_MS = 1000 * 60 * 60 * 24;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParticipantsPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/participants`);
  }

  const challengeId = id as Id<"challenges">;

  const dashboardData = await convex.query(api.queries.challenges.getDashboardData, {
    challengeId,
    userId: user._id,
  });

  if (!dashboardData) {
    notFound();
  }

  const { challenge, participation, leaderboard, stats, latestActivityId } = dashboardData;

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
    Math.ceil((challenge.endDate - now.getTime()) / DAY_IN_MS)
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
      <PageContainer maxWidth="xl" padding="lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Participants</h1>
          <p className="text-sm text-zinc-400">All members in this challenge.</p>
        </div>
        <ParticipantsList challengeId={challenge.id} />
      </PageContainer>
    </DashboardLayoutWrapper>
  );
}
