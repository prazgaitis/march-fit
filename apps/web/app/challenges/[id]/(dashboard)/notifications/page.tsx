import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { NotificationsList } from "./notifications-list";

interface NotificationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const convex = getConvexClient();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return null;

  const challengeId = id as Id<"challenges">;

  const [challenge, notifications] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    convex.query(api.queries.notifications.getByUser, {
      userId: user._id,
    }),
  ]);

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Notifications</h1>
      <NotificationsList
        notifications={notifications}
        challengeId={challenge._id}
        userId={user._id}
      />
    </div>
  );
}
