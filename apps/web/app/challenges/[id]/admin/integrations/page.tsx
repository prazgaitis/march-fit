import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { IntegrationsTabs } from "./integrations-tabs";

interface IntegrationsAdminPageProps {
  params: Promise<{ id: string }>;
}

export default async function IntegrationsAdminPage({
  params,
}: IntegrationsAdminPageProps) {
  const convex = getConvexClient();
  const { id } = await params;
  const challenge = await getChallengeOrThrow(id);

  const adminStatus = await convex.query(api.queries.participations.isUserChallengeAdmin, {
    challengeId: challenge.id as Id<"challenges">,
  });

  if (!adminStatus.isAdmin) {
    return null;
  }

  // Fetch activity types and Strava participants in parallel
  const [activityTypes, participantsWithStrava] = await Promise.all([
    convex.query(api.queries.activityTypes.getByChallengeId, {
      challengeId: challenge.id as Id<"challenges">,
    }),
    convex.query(api.queries.integrations.getChallengeParticipantsWithStrava, {
      challengeId: challenge.id as Id<"challenges">,
    }),
  ]);

  return (
    <IntegrationsTabs
      challengeId={challenge.id}
      activityTypes={activityTypes}
      participantsWithStrava={participantsWithStrava}
    />
  );
}
