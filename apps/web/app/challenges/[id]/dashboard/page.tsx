import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { type ChallengeSummary } from "@/components/dashboard/challenge-realtime-context";
import { getCurrentUser } from "@/lib/auth";
import { fetchAuthQuery, getToken } from "@/lib/server-auth";
import { DashboardLayoutWrapper } from "../notifications/dashboard-layout-wrapper";
import { dateOnlyToUtcMs } from "@/lib/date-only";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

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
      {/* Onboarding card skeleton */}
      <div className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
      {/* Feed skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-xl bg-zinc-900/50" />
      ))}
    </div>
  );
}

/**
 * Page component — renders an immediate shell with Suspense,
 * deferring auth + data fetches so the layout can stream.
 */
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

/**
 * Async server component that performs all auth + data fetching.
 * Wrapped in Suspense by the parent so the shell streams immediately.
 */
async function DashboardContent({
  challengeSlug,
}: {
  challengeSlug: string;
}) {
  const convex = getConvexClient();
  const dashStart = performance.now();
  const user = await getCurrentUser();

  if (!user) {
    const token = await getToken();
    if (token) {
      redirect(`/challenges/${challengeSlug}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${challengeSlug}/dashboard`);
  }

  const challengeId = challengeSlug as Id<"challenges">;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isMobileRequest = /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(
    userAgent,
  );

  const [dashboardData, initialFeed] = await Promise.all([
    convex.query(api.queries.challenges.getDashboardData, {
      challengeId,
      userId: user._id,
    }),
    fetchAuthQuery<InitialFeedResponse>(api.queries.activities.getChallengeFeed, {
      challengeId,
      followingOnly: false,
      includeEngagementCounts: !isMobileRequest,
      includeMediaUrls: !isMobileRequest,
      paginationOpts: {
        numItems: 10,
        cursor: null,
      },
    }).catch((error) => {
      console.error("[perf] dashboard initial feed preload failed", error);
      return { page: [] };
    }),
  ]);

  console.log(
    `[perf] dashboard page total: ${Math.round(performance.now() - dashStart)}ms`,
  );

  if (!dashboardData) {
    notFound();
  }

  const { challenge, participation, leaderboard, stats, latestActivityId } =
    dashboardData;

  const canAccess =
    user.role === "admin" ||
    challenge.creatorId === user._id ||
    Boolean(participation);

  if (!canAccess) {
    redirect(`/challenges/${challenge.id}`);
  }

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((dateOnlyToUtcMs(challenge.endDate) - now.getTime()) / DAY_IN_MS),
  );
  const initialSummary: ChallengeSummary = {
    stats: {
      ...stats,
      daysRemaining,
    },
    leaderboard: leaderboard.map((entry: (typeof leaderboard)[number]) => ({
      participantId: entry.participantId,
      totalPoints: entry.totalPoints,
      currentStreak: entry.currentStreak,
      user: entry.user,
    })),
    latestActivityId: latestActivityId ?? null,
    timestamp: new Date().toISOString(),
  };

  return (
    <DashboardLayoutWrapper
      challenge={{
        id: challenge.id,
        name: challenge.name,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      }}
      currentUserId={user._id}
      currentUser={user}
      initialSummary={initialSummary}
    >
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <OnboardingCard challengeId={challenge.id} userId={user._id} />
        <ActivityFeed
          challengeId={challenge.id}
          initialItems={initialFeed.page}
          initialLightweightMode={isMobileRequest}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}
