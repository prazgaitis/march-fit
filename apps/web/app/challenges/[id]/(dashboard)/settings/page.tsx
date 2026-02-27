import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { SettingsContent } from "./settings-content";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const convex = getConvexClient();
  const [currentUser, { id }] = await Promise.all([getCurrentUser(), params]);
  if (!currentUser) return null;

  const challengeId = id as Id<"challenges">;
  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId,
  });

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsContent
        currentUser={currentUser}
        currentChallengeId={challenge._id}
        allowGenderEdit={challenge.allowGenderEdit ?? false}
        currentGender={currentUser.gender ?? null}
      />
    </div>
  );
}
