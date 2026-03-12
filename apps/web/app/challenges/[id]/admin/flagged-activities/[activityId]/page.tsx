import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/server-auth";
import { FlaggedActivityDetailContent } from "./flagged-activity-detail-content";

interface FlaggedActivityDetailPageProps {
  params: Promise<{ id: string; activityId: string }>;
}

export default async function FlaggedActivityDetailPage({
  params,
}: FlaggedActivityDetailPageProps) {
  const convex = getConvexClient();
  const { id: challengeId, activityId } = await params;

  // Quick existence check — the client component will fetch full detail via real-time query
  const detail = await convex.query(
    api.queries.admin.getFlaggedActivityDetail,
    {
      activityId: activityId as Id<"activities">,
    },
  );

  if (!detail) {
    notFound();
  }

  const adminStatus = await fetchAuthQuery<{
    isAdmin: boolean;
    reason: "global_admin" | "creator" | "challenge_admin" | null;
  }>(api.queries.participations.isUserChallengeAdmin, {
    challengeId: detail.activity.challengeId as Id<"challenges">,
  });

  if (!adminStatus.isAdmin) {
    notFound();
  }

  return (
    <FlaggedActivityDetailContent
      challengeId={challengeId}
      activityId={activityId}
    />
  );
}
