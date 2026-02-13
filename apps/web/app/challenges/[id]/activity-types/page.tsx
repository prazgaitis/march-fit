import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../notifications/dashboard-layout-wrapper";
import { ActivityTypesList } from "./activity-types-list";

interface ActivityTypesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivityTypesPage({ params }: ActivityTypesPageProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/activity-types`);
  }

  const challengeId = id as Id<"challenges">;

  const [challenge, participation, activityTypes, categories] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getByUserAndChallenge, {
      userId: user._id,
      challengeId,
    }),
    convex.query(api.queries.activityTypes.getByChallengeId, { challengeId }),
    convex.query(api.queries.categories.getChallengeCategories, { challengeId }),
  ]);

  if (!challenge) {
    notFound();
  }

  const canAccess =
    user.role === "admin" ||
    challenge.creatorId === user._id ||
    Boolean(participation);

  if (!canAccess) {
    redirect(`/challenges/${id}`);
  }

  // Group activity types by category
  const categoryMap = new Map<string, { _id: string; name: string }>(categories.map((c: { _id: string; name: string }) => [c._id, c]));

  return (
    <DashboardLayoutWrapper
      challenge={{
        id: challenge._id,
        name: challenge.name,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }}
      currentUserId={user._id}
      currentUser={user}
      hideRightSidebar
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-2 text-2xl font-bold">Activity Types</h1>
        <p className="mb-6 text-zinc-500">
          Here are all the ways you can earn points in this challenge.
        </p>
        <ActivityTypesList
          activityTypes={activityTypes}
          categoryMap={categoryMap}
          streakMinPoints={challenge.streakMinPoints}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}
