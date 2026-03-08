import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { InstaFeed } from "./insta-feed";
import { getCurrentUser } from "@/lib/auth";
import { fetchAuthQuery } from "@/lib/server-auth";

interface InstaPageProps {
  params: Promise<{ id: string }>;
}

interface InitialFeedResponse {
  page: Array<{
    activity: {
      _id: string;
      notes: string | null;
      pointsEarned: number;
      loggedDate: number;
      createdAt: number;
      metrics?: Record<string, unknown>;
      triggeredBonuses?: Array<{
        metric: string;
        threshold: number;
        bonusPoints: number;
        description: string;
      }>;
    };
    user: {
      id: string;
      name: string | null;
      username: string;
      avatarUrl: string | null;
    } | null;
    activityType: {
      id: string | null;
      name: string | null;
      categoryId: string | null;
      scoringConfig?: Record<string, unknown>;
    } | null;
    likes: number;
    comments: number;
    likedByUser: boolean;
    mediaUrls: string[];
  }>;
}

function InstaPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Stories skeleton */}
      <div className="flex gap-3 overflow-hidden py-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-zinc-900/50" />
            <div className="h-3 w-12 animate-pulse rounded bg-zinc-900/50" />
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-xl bg-zinc-900/50" />
      ))}
    </div>
  );
}

export default async function InstaPage({ params }: InstaPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<InstaPageSkeleton />}>
      <InstaContent challengeSlug={id} />
    </Suspense>
  );
}

async function InstaContent({ challengeSlug }: { challengeSlug: string }) {
  const convex = getConvexClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const challengeId = challengeSlug as Id<"challenges">;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isMobileRequest = /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(
    userAgent,
  );

  const [challenge, initialFeed, initialAlgoFeed] = await Promise.all([
    convex.query(api.queries.challenges.getById, { challengeId }),
    fetchAuthQuery<InitialFeedResponse>(
      api.queries.activities.getChallengeFeed,
      {
        challengeId,
        followingOnly: false,
        includeEngagementCounts: !isMobileRequest,
        includeMediaUrls: true,
        paginationOpts: {
          numItems: 10,
          cursor: null,
        },
      },
    ).catch(() => ({ page: [] })),
    fetchAuthQuery<InitialFeedResponse>(
      api.queries.algorithmicFeed.getAlgorithmicFeed,
      {
        challengeId,
        includeEngagementCounts: !isMobileRequest,
        includeMediaUrls: true,
      },
    ).catch(() => ({ page: [] })),
  ]);

  if (!challenge) notFound();

  return (
    <InstaFeed
      challengeId={challenge._id}
      challengeStartDate={challenge.startDate}
      currentUser={{
        id: user._id,
        name: user.name ?? null,
        username: user.username,
        avatarUrl: user.avatarUrl ?? null,
      }}
      initialItems={initialFeed.page}
      initialAlgoItems={initialAlgoFeed.page}
      initialLightweightMode={isMobileRequest}
    />
  );
}
