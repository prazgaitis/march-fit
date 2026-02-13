import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { getCurrentUser } from "@/lib/auth";
import { getToken, isAuthenticated } from "@/lib/server-auth";
import { formatDateShortFromDateOnly } from "@/lib/date-only";

interface DashboardSsrDebugPageProps {
  params: Promise<{ id: string }>;
}

interface InitialFeedResponse {
  page: Array<{
    activity: {
      _id: string;
      pointsEarned: number;
      loggedDate: number;
      createdAt: number;
      notes?: string | null;
      metrics?: Record<string, unknown>;
    };
    user: {
      id: string;
      username: string;
      name: string | null;
    } | null;
    activityType: {
      id: string | null;
      name: string | null;
    } | null;
    likes: number;
    comments: number;
    likedByUser: boolean;
  }>;
}

interface DashboardDataResponse {
  challenge: {
    _id: string;
    creatorId: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  participation: unknown | null;
  leaderboard: Array<{
    participantId: string;
    totalPoints: number;
    currentStreak: number;
    user: {
      id: string;
      name: string | null;
      username: string;
      avatarUrl: string | null;
    };
  }>;
  stats: {
    totalParticipants: number;
    userPoints: number;
    userRank: number | null;
  };
}

function formatPoints(value: number): string {
  const normalized = Math.round((value + Number.EPSILON) * 100) / 100;
  return normalized.toString();
}

export default async function DashboardSsrDebugPage({
  params,
}: DashboardSsrDebugPageProps) {
  const [{ id }, user, token] = await Promise.all([
    params,
    getCurrentUser(),
    getToken(),
  ]);

  if (!user) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      redirect(`/challenges/${id}`);
    }
    redirect(`/sign-in?redirect_url=/challenges/${id}/dashboard-ssr-debug`);
  }

  const challengeId = id as Id<"challenges">;

  const [dashboardData, feed] = await Promise.all([
    fetchQuery(api.queries.challenges.getDashboardData, {
      challengeId,
      userId: user._id,
    }) as Promise<DashboardDataResponse | null>,
    fetchQuery(
      api.queries.activities.getChallengeFeed,
      {
        challengeId,
        followingOnly: false,
        includeEngagementCounts: true,
        includeMediaUrls: false,
        paginationOpts: {
          numItems: 25,
          cursor: null,
        },
      },
      token ? { token } : {}
    ) as Promise<InitialFeedResponse>,
  ]);

  if (!dashboardData) {
    notFound();
  }

  const { challenge, participation, leaderboard, stats } = dashboardData;
  const canAccess =
    user.role === "admin" ||
    challenge.creatorId === user._id ||
    Boolean(participation);

  if (!canAccess) {
    redirect(`/challenges/${id}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard SSR Debug</h1>
          <p className="text-sm text-muted-foreground">
            Fully server-rendered snapshot for challenge{" "}
            <span className="font-mono">{challenge._id}</span>
          </p>
        </div>
        <Link
          href={`/challenges/${id}/dashboard`}
          className="rounded border px-3 py-2 text-sm hover:bg-accent"
        >
          Back to Dashboard
        </Link>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded border bg-card p-3">
          <p className="text-xs text-muted-foreground">Challenge</p>
          <p className="font-medium">{challenge.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateShortFromDateOnly(challenge.startDate)} -{" "}
            {formatDateShortFromDateOnly(challenge.endDate)}
          </p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-xs text-muted-foreground">Participants</p>
          <p className="text-xl font-semibold">{stats.totalParticipants}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-xs text-muted-foreground">Your Points</p>
          <p className="text-xl font-semibold">{formatPoints(stats.userPoints)}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-xs text-muted-foreground">Your Rank</p>
          <p className="text-xl font-semibold">{stats.userRank ?? "-"}</p>
        </div>
      </section>

      <section className="mb-6 rounded border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Top Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leaderboard data.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {leaderboard.map((entry: DashboardDataResponse["leaderboard"][number], index: number) => (
              <li key={entry.participantId} className="flex items-center justify-between">
                <span>
                  {index + 1}. {entry.user.name ?? entry.user.username}
                </span>
                <span className="font-medium">{formatPoints(entry.totalPoints)} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Recent Feed (SSR)</h2>
        {feed.page.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activities found.</p>
        ) : (
          <ul className="space-y-2">
            {feed.page.map((item: InitialFeedResponse["page"][number]) => (
              <li key={item.activity._id} className="rounded border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">
                      {item.user?.name ?? item.user?.username ?? "Unknown user"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      logged {item.activityType?.name ?? "activity"}
                    </span>
                  </div>
                  <span className="font-semibold">
                    +{formatPoints(item.activity.pointsEarned)} pts
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.activity.createdAt).toLocaleString()} |{" "}
                  {item.likes} likes | {item.comments} comments |{" "}
                  likedByYou: {item.likedByUser ? "yes" : "no"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
