import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ChallengePageContent } from "@/components/challenges/challenge-page-content";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function ChallengePage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  try {
    const challengeId = id as Id<"challenges">;

    const challenge = await convex.query(
      api.queries.challenges.getByIdWithCount,
      { challengeId },
    );

    if (!challenge) {
      notFound();
    }

    let isParticipating = false;
    if (user) {
      try {
        isParticipating = await convex.query(api.queries.users.isParticipating, {
          userId: user._id,
          challengeId,
        });
      } catch (error) {
        console.error("Error fetching user participation:", error);
        isParticipating = false;
      }
    }

    let participants: Array<{
      id: string;
      username: string;
      name: string | null;
      avatarUrl: string | null;
      joinedAt: number;
    }> = [];
    try {
      participants = await convex.query(api.queries.participations.getRecent, {
        challengeId,
        limit: 10,
      });
    } catch (error) {
      console.error("Error fetching participants:", error);
      participants = [];
    }

    const activityTypes = await convex.query(
      api.queries.activityTypes.getByChallengeId,
      { challengeId }
    );

    return (
      <ChallengePageContent
        challenge={{
          ...challenge,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
        }}
        isParticipating={isParticipating}
        isSignedIn={Boolean(user)}
        participants={participants.map((p) => ({
          ...p,
          joinedAt: new Date(p.joinedAt).toISOString(),
        }))}
        activityTypes={activityTypes}
      />
    );
  } catch (error) {
    console.error("Error loading challenge page:", error);
    notFound();
  }
}
