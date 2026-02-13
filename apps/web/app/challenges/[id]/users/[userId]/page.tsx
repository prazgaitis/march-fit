import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../../notifications/dashboard-layout-wrapper";
import { UserProfileContent } from "./user-profile-content";

interface UserProfilePageProps {
  params: Promise<{ id: string; userId: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const convex = getConvexClient();
  const [currentUser, { id, userId }] = await Promise.all([
    getCurrentUser(),
    params,
  ]);

  if (!currentUser) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/users/${userId}`);
  }

  const challengeId = id as Id<"challenges">;
  const profileUserId = userId as Id<"users">;

  const [challenge, participation] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getByUserAndChallenge, {
      userId: currentUser._id,
      challengeId,
    }),
  ]);

  if (!challenge) {
    notFound();
  }

  const canAccess =
    currentUser.role === "admin" ||
    challenge.creatorId === currentUser._id ||
    Boolean(participation);

  if (!canAccess) {
    redirect(`/challenges/${id}`);
  }

  return (
    <DashboardLayoutWrapper
      challenge={{
        id: challenge._id,
        name: challenge.name,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }}
      currentUserId={currentUser._id}
      currentUser={currentUser}
      hideRightSidebar
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        <UserProfileContent
          challengeId={challenge._id}
          profileUserId={profileUserId}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}
