import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
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
  if (!currentUser) return null;

  const challengeId = id as Id<"challenges">;
  const profileUserId = userId as Id<"users">;

  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId,
  });

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <UserProfileContent
        challengeId={challenge._id}
        profileUserId={profileUserId}
      />
    </div>
  );
}
