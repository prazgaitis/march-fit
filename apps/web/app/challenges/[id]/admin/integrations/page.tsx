import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { IntegrationsTabs } from "./integrations-tabs";

interface IntegrationsAdminPageProps {
  params: Promise<{ id: string }>;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function IntegrationsAdminPage({
  params,
}: IntegrationsAdminPageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const challenge = await getChallengeOrThrow(id);

  if (challenge.creatorId !== user._id && user.role !== "admin") {
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
