import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminActivityTypesTable } from "@/components/admin/admin-activity-types-table";

interface ActivityTypesAdminPageProps {
  params: Promise<{ id: string }>;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function ActivityTypesAdminPage({
  params,
}: ActivityTypesAdminPageProps) {
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
