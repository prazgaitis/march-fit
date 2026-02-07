import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ChallengeHeader } from "@/components/challenges/challenge-header";
import { ChallengeDetails } from "@/components/challenges/challenge-details";
import { ParticipantsList } from "@/components/challenges/participants-list";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function ChallengePage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  try {
    // Convert string ID to Convex ID format (it should already be a Convex ID)
    const challengeId = id as Id<"challenges">;

    // Get challenge with participant count
    const challenge = await convex.query(
      api.queries.challenges.getByIdWithCount,
      { challengeId },
    );

    if (!challenge) {
      notFound();
    }

    // Check if current user is participating
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

    // Get recent participants
    let participants = [];
    try {
      participants = await convex.query(api.queries.participations.getRecent, {
        challengeId,
        limit: 10,
      });
    } catch (error) {
      console.error("Error fetching participants:", error);
      participants = [];
    }

    return (
      <div className="min-h-screen bg-background text-foreground page-with-header">
        <ChallengeHeader
          challenge={{
            ...challenge,
            startDate: new Date(challenge.startDate),
            endDate: new Date(challenge.endDate),
            createdAt: new Date(challenge.createdAt),
          }}
          isParticipating={isParticipating}
          isSignedIn={Boolean(user)}
        />

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <ChallengeDetails
                challenge={{
                  ...challenge,
                  startDate: new Date(challenge.startDate),
                  endDate: new Date(challenge.endDate),
                }}
              />
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <ParticipantsList
                challengeId={id}
                participants={participants.map((p: (typeof participants)[number]) => ({
                  ...p,
                  joinedAt: new Date(p.joinedAt),
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading challenge page:", error);
    notFound();
  }
}
