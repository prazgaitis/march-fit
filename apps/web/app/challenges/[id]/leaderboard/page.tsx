import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../notifications/dashboard-layout-wrapper";
import { LeaderboardTabs } from "./leaderboard-tabs";

interface LeaderboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/leaderboard`);
  }

  const challengeId = id as Id<"challenges">;

  const [challenge, participation, leaderboardEntries] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getByUserAndChallenge, {
      userId: user._id,
      challengeId,
    }),
    convex.query(api.queries.participations.getFullLeaderboard, {
      challengeId,
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

  return (
    <DashboardLayoutWrapper
      challenge={{
        id: challenge._id,
        name: challenge.name,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }}
      currentUserId={user._id}
      currentUser={user}
      hideRightSidebar
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">Leaderboard</h1>
        <LeaderboardTabs
          entries={leaderboardEntries}
          challengeId={challenge._id}
          currentUserId={user._id}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}
