import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { getCurrentUser } from "@/lib/auth";
import { fetchAuthQuery } from "@/lib/server-auth";
import { dateOnlyToUtcMs } from "@/lib/date-only";

interface ChallengeDashboardPageProps {
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

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-xl bg-zinc-900/50" />
      ))}
    </div>
  );
}

export default async function ChallengeDashboardPage({
  params,
}: ChallengeDashboardPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent challengeSlug={id} />
    </Suspense>
  );
}

async function DashboardContent({ challengeSlug }: { challengeSlug: string }) {
  const convex = getConvexClient();
  const dashStart = performance.now();
  const user = await getCurrentUser();
  if (!user) return null; // Layout handles redirect

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
    ).catch((error) => {
      console.error("[perf] dashboard initial feed preload failed", error);
      return { page: [] };
    }),
    fetchAuthQuery<InitialFeedResponse>(
      api.queries.algorithmicFeed.getAlgorithmicFeed,
      {
        challengeId,
        includeEngagementCounts: !isMobileRequest,
        includeMediaUrls: true,
        paginationOpts: {
          numItems: 10,
          cursor: null,
        },
      },
    ).catch((error) => {
      console.error("[perf] dashboard algo feed preload failed", error);
      return { page: [] };
    }),
  ]);

  console.log(
    `[perf] dashboard page total: ${Math.round(performance.now() - dashStart)}ms`,
  );

  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {dateOnlyToUtcMs(challenge.startDate) > Date.now() && (
        <OnboardingCard
          challengeId={challenge._id}
          userId={user._id}
          challengeStartDate={challenge.startDate}
        />
      )}
      <ActivityFeed
        challengeId={challenge._id}
        initialItems={initialFeed.page}
        initialAlgoItems={initialAlgoFeed.page}
        initialLightweightMode={isMobileRequest}
      />
    </div>
  );
}
