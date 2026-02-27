import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { ActivityDetailContent } from "./activity-detail-content";

interface ActivityDetailPageProps {
  params: Promise<{ id: string; activityId: string }>;
}

export default async function ActivityDetailPage({
  params,
}: ActivityDetailPageProps) {
  const convex = getConvexClient();
  const [user, { id: challengeId, activityId }] = await Promise.all([
    getCurrentUser(),
    params,
  ]);
  if (!user) return null;

  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  if (!challenge) notFound();

  return (
    <ActivityDetailContent
      challengeId={challengeId}
      activityId={activityId}
    />
  );
}
