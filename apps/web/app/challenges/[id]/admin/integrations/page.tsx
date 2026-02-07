import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminIntegrationsTable } from "@/components/admin/admin-integrations-table";

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

  // Fetch activity types for this challenge
  const activityTypes = await convex.query(api.queries.activityTypes.getByChallengeId, {
    challengeId: challenge.id as Id<"challenges">,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Mappings</CardTitle>
        <CardDescription>
          Configure how activities from external services like Strava are mapped to your challenge
          activity types. When users sync activities from connected services, they will
          automatically be logged as the mapped activity type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdminIntegrationsTable
          challengeId={challenge.id}
          activityTypes={activityTypes}
        />
      </CardContent>
    </Card>
  );
}
