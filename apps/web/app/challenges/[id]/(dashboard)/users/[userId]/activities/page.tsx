import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { UserActivitiesContent } from "./user-activities-content";

interface UserActivitiesPageProps {
  params: Promise<{ id: string; userId: string }>;
}

export default async function UserActivitiesPage({
  params,
}: UserActivitiesPageProps) {
  const convex = getConvexClient();
  const [currentUser, { id, userId }] = await Promise.all([
    getCurrentUser(),
    params,
  ]);
  if (!currentUser) return null;

  const challengeId = id as Id<"challenges">;
  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId,
  });

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <UserActivitiesContent challengeId={id} profileUserId={userId} />
    </div>
  );
}
