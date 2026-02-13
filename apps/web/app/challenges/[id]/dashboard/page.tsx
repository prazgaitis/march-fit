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

export default async function ChallengeDashboardPage({
  params,
}: ChallengeDashboardPageProps) {
  const convex = getConvexClient();
  const dashStart = performance.now();
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);

  if (!user) {
    // getCurrentUser() returns null when either:
    // 1. No auth token exists (not signed in), or
    // 2. Token exists but Convex user record couldn't be resolved
    // Use getToken() to distinguish the two cases without an extra round trip
    // (getToken is cached via React.cache from getCurrentUser's call)
    const token = await getToken();
    if (token) {
      // Signed in but Convex record missing — redirect to challenge page
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/dashboard`);
  }

  const challengeId = id as Id<"challenges">;
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
