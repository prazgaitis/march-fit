import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminActivityTypesTable } from "@/components/admin/admin-activity-types-table";

interface ActivityTypesAdminPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivityTypesAdminPage({
  params,
}: ActivityTypesAdminPageProps) {
  const convex = getConvexClient();
  const user = await requireAuth();
  const { id } = await params;
  const challenge = await getChallengeOrThrow(id);

  if (challenge.creatorId !== user._id && user.role !== "admin") {
    return null;
  }

  const items = await convex.query(api.queries.activityTypes.getByChallengeId, {
    challengeId: challenge.id as Id<"challenges">,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Types</CardTitle>
      </CardHeader>
      <CardContent>
        <AdminActivityTypesTable challengeId={challenge.id} items={items} />
      </CardContent>
    </Card>
  );
}
