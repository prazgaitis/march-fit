import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { InviteLeaderboardList } from "./invite-leaderboard-list";

interface InviteLeaderboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function InviteLeaderboardPage({
  params,
}: InviteLeaderboardPageProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return null;

  const challengeId = id as Id<"challenges">;

  const [challenge, entries] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getInviteLeaderboard, {
      challengeId,
    }),
  ]);

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold">Invite Leaderboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ranked by number of people invited to {challenge.name}
      </p>
      <InviteLeaderboardList
        entries={entries}
        challengeId={challenge._id}
        currentUserId={user._id}
      />
    </div>
  );
}
