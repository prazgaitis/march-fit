import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { ActivityTypesPageContent } from "./activity-types-page-content";

interface ActivityTypesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivityTypesPage({ params }: ActivityTypesPageProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return null;

  const challengeId = id as Id<"challenges">;

  const [challenge, activityTypes, categories] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.activityTypes.getByChallengeId, { challengeId }),
    convex.query(api.queries.categories.getChallengeCategories, { challengeId }),
  ]);

  if (!challenge) notFound();

  const categoryMap = new Map<string, { _id: string; name: string; sortOrder?: number }>(
    categories.map((c: { _id: string; name: string; sortOrder?: number }) => [c._id, c]),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Earning Points</h1>
      <ActivityTypesPageContent
        challengeId={challengeId}
        activityTypes={activityTypes}
        categoryMap={categoryMap}
        streakMinPoints={challenge.streakMinPoints}
      />
    </div>
  );
}
