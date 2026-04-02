import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { LeaderboardTabs } from "./leaderboard-tabs";
import { WinnersBanner } from "@/components/challenges/winners-banner";

interface LeaderboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return null;

  const challengeId = id as Id<"challenges">;

  const [challenge, leaderboardEntries] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getFullLeaderboard, {
      challengeId,
    }),
  ]);

  if (!challenge) notFound();

  // Enrich winners with user data and points from the leaderboard
  const winners = (challenge.winners ?? []).map((w: any) => {
    const entry = leaderboardEntries.find(
      (e: any) => e.user.id === w.userId,
    );
    return {
      ...w,
      user: entry?.user ?? null,
      totalPoints: entry?.totalPoints,
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Leaderboard</h1>
      {winners.length > 0 && (
        <WinnersBanner winners={winners} className="mb-6" />
      )}
      <LeaderboardTabs
        entries={leaderboardEntries}
        challengeId={challenge._id}
        currentUserId={user._id}
      />
    </div>
  );
}
