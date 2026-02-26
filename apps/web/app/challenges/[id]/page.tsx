import { notFound } from "next/navigation";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ChallengePageContent } from "@/components/challenges/challenge-page-content";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallengePage({ params }: PageProps) {
  const convex = getConvexClient();
  const pageStart = performance.now();
  const [user, { id }, headersList] = await Promise.all([
    getCurrentUser(),
    params,
    headers(),
  ]);

  try {
    const challengeId = id as Id<"challenges">;

    const [challenge, participants, activityTypes, isParticipating] =
      await Promise.all([
        convex.query(api.queries.challenges.getByIdWithCount, { challengeId }),
        convex
          .query(api.queries.participations.getRecent, {
            challengeId,
            limit: 10,
          })
          .catch((error) => {
            console.error("Error fetching participants:", error);
            return [] as Array<{
              id: string;
              username: string;
              name: string | null;
              avatarUrl: string | null;
              joinedAt: number;
            }>;
          }),
        convex.query(api.queries.activityTypes.getByChallengeId, {
          challengeId,
        }),
        user
          ? convex
              .query(api.queries.users.isParticipating, {
                userId: user._id,
                challengeId,
              })
              .catch((error) => {
                console.error("Error fetching user participation:", error);
                return false;
              })
          : Promise.resolve(false),
      ]);

    console.log(
      `[perf] challenge page queries: ${Math.round(performance.now() - pageStart)}ms`,
    );

    if (!challenge) {
      const referer = headersList.get("referer");
      Sentry.captureMessage("Challenge not found — possible broken link", {
        level: "warning",
        extra: {
          challengeId: id,
          referer: referer ?? "(direct / none)",
        },
        tags: {
          referrer_host: referer
            ? (() => {
                try {
                  return new URL(referer).hostname;
                } catch {
                  return "unparseable";
                }
              })()
            : "direct",
        },
      });
      notFound();
    }

    return (
      <ChallengePageContent
        challenge={{
          ...challenge,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
        }}
        isParticipating={isParticipating}
        isSignedIn={Boolean(user)}
        participants={participants.map((p: (typeof participants)[number]) => ({
          ...p,
          joinedAt: new Date(p.joinedAt).toISOString(),
        }))}
        activityTypes={activityTypes}
      />
    );
  } catch (error) {
    const referer = headersList.get("referer");
    console.error("Error loading challenge page:", error);
    Sentry.captureException(error, {
      extra: {
        challengeId: id,
        referer: referer ?? "(direct / none)",
      },
      tags: {
        referrer_host: referer
          ? (() => {
              try {
                return new URL(referer).hostname;
              } catch {
                return "unparseable";
              }
            })()
          : "direct",
      },
    });
    notFound();
  }
}
