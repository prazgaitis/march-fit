import { notFound } from "next/navigation";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { LedgerContent } from "./ledger-content";

interface LedgerPageProps {
  params: Promise<{ id: string; userId: string }>;
}

export default async function LedgerPage({ params }: LedgerPageProps) {
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
    <div className="w-full max-w-none px-0 py-0">
      <LedgerContent
        challengeId={challenge._id}
        profileUserId={profileUserId}
      />
    </div>
  );
}
