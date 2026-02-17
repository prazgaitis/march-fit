import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../../notifications/dashboard-layout-wrapper";
import { SettingsContent } from "./settings-content";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const convex = getConvexClient();
  const [currentUser, { id }] = await Promise.all([
    getCurrentUser(),
    params,
  ]);

  if (!currentUser) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/settings`);
  }

  const challengeId = id as Id<"challenges">;

  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId,
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
      currentUserId={currentUser._id}
      currentUser={currentUser}
      hideRightSidebar
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        <SettingsContent
          currentUser={currentUser}
          currentChallengeId={challenge._id}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}
