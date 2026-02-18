import { notFound, redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { isAuthenticated } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../../notifications/dashboard-layout-wrapper";
import { ForumPostDetail } from "@/components/forum/forum-post-detail";

interface ForumPostPageProps {
  params: Promise<{ id: string; postId: string }>;
}

export default async function ForumPostPage({ params }: ForumPostPageProps) {
  const [user, { id, postId }] = await Promise.all([getCurrentUser(), params]);

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/forum/${postId}`);
  }

  const convex = getConvexClient();
  const challengeId = id as Id<"challenges">;

  const [challenge, participation] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.participations.getByUserAndChallenge, {
      userId: user._id,
      challengeId,
    }),
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
        <ForumPostDetail
          postId={postId as Id<"forumPosts">}
          challengeId={challenge._id}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}
