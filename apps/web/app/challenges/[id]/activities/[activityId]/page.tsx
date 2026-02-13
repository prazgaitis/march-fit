import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../../notifications/dashboard-layout-wrapper";
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

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${challengeId}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${challengeId}/activities/${activityId}`);
  }

  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  if (!challenge) {
    notFound();
  }

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
    >
      <ActivityDetailContent
        challengeId={challengeId}
        activityId={activityId}
      />
    </DashboardLayoutWrapper>
  );
}
