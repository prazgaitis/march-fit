import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { AlgorithmicFeed } from "./algorithmic-feed";
import { getCurrentUser } from "@/lib/auth";

interface AlgoFeedPageProps {
  params: Promise<{ id: string }>;
}

export default async function AlgoFeedPage({ params }: AlgoFeedPageProps) {
  const { id } = await params;
  const convex = getConvexClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const challengeId = id as Id<"challenges">;
  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId,
  });

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Algorithmic Feed (experimental) — activities ranked by quality, engagement, and relevance instead of time.
      </div>
      <AlgorithmicFeed challengeId={challenge._id} />
    </div>
  );
}
