import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { dateOnlyToUtcMs, formatDateShortFromDateOnly } from "@/lib/date-only";

export const dynamic = "force-dynamic";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { UserAvatar } from "@/components/user-avatar";
import { StravaConnectButton } from "@/components/integrations/strava-connect-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { ApiKeySection } from "@/components/api-key-section";

interface Achievement {
  title: string;
  description: string;
}

export default async function ProfilePage() {
  const convex = getConvexClient();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/profile");
  }

  const profile = await convex.query(api.queries.users.getGlobalProfile, {
    userId: user._id as Id<"users">,
  });

  if (!profile) {
    redirect("/sign-in?redirect_url=/profile");
  }

  const { stats, participations, recentActivities } = profile;
  const integrations = await convex.query(api.queries.integrations.getByUser, {
    userId: user._id as Id<"users">,
  });
  const hasStrava = integrations.some(
    (integration: { service: string; revoked: boolean; accessToken?: string }) =>
      integration.service === "strava" &&
      integration.revoked === false &&
      integration.accessToken
  );
  const now = new Date();
  type Participation = (typeof participations)[number];
  const activeChallenges = participations.filter(
    (entry: Participation) =>
      entry.challenge && dateOnlyToUtcMs(entry.challenge.endDate) > now.getTime()
  ).length;
  const completedChallenges = participations.length - activeChallenges;
  const longestStreak = participations.reduce(
    (max: number, entry: Participation) => Math.max(max, entry.currentStreak ?? 0),
    0
  );
  const mostPointsChallenge = participations.reduce<Participation | null>(
    (best: Participation | null, entry: Participation) => {
      if (!best || (entry.totalPoints ?? 0) > (best.totalPoints ?? 0)) {
        return entry;
      }
      return best;
    },
    null
  );

  const achievements: Achievement[] = [];
  if (mostPointsChallenge?.challenge) {
    achievements.push({
      title: "Top challenge score",
      description: `${mostPointsChallenge.challenge.name}: ${mostPointsChallenge.totalPoints.toFixed(0)} pts`,
    });
  }
  if (longestStreak > 0) {
    achievements.push({
      title: "Consistency star",
      description: `${longestStreak} day streak maintained`,
    });
  }
  if (completedChallenges > 0) {
    achievements.push({
      title: "Challenge finisher",
      description: `${completedChallenges} challenge${
        completedChallenges === 1 ? "" : "s"
      } completed`,
    });
  }
  if (stats.totalActivities >= 25) {
    achievements.push({
      title: "Mileage milestone",
      description: `${stats.totalActivities} activities logged in total`,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="container mx-auto px-4 space-y-8">
        <section className="rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                Athlete profile
              </p>
              <h1 className="mt-3 text-3xl font-bold text-gray-900">
                {user.name ?? user.username}
              </h1>
              <p className="text-muted-foreground">@{user.username}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Joined the community{" "}
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-6 text-center md:w-auto md:grid-cols-4">
              <ProfileHighlight
                label="Total points"
                value={stats.totalPoints.toFixed(0)}
              />
              <ProfileHighlight label="Activities" value={stats.totalActivities} />
              <ProfileHighlight label="Active challenges" value={activeChallenges} />
              <ProfileHighlight label="Longest streak" value={`${longestStreak}d`} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Challenge participation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {participations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t joined a challenge yet. Jump into the next one to
                  start climbing the leaderboard.
                </p>
              )}
              {participations.map((entry: Participation) =>
                entry.challenge ? (
                  <div
                    key={entry.challenge.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {entry.challenge.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {format(new Date(entry.joinedAt), "MMM d, yyyy")} ·{" "}
                        Ends{" "}
                        {formatDateShortFromDateOnly(entry.challenge.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>{entry.totalPoints.toFixed(0)} pts</span>
                      <span>Streak {entry.currentStreak} days</span>
                    </div>
                  </div>
                ) : null
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {!hasStrava && (
              <Card>
                <CardHeader>
                  <CardTitle>Connect Strava</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Link your Strava account to automatically import activities and
                    keep your challenge stats in sync.
                  </p>
                  <StravaConnectButton
                    successUrl="/profile"
                    errorUrl="/profile?error=strava_auth_failed"
                  />
                  <Button asChild variant="ghost" className="w-full">
                    <Link href="/integrations">View all integrations</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Achievements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {achievements.length === 0 ? (
                  <p>
                    Keep logging activities to unlock personal bests and celebrate
                    your progress.
                  </p>
                ) : (
                  achievements.map((achievement) => (
                    <div
                      key={achievement.title}
                      className="rounded-lg border bg-background/60 p-3 shadow-sm"
                    >
                      <p className="font-semibold text-foreground">
                        {achievement.title}
                      </p>
                      <p>{achievement.description}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <ApiKeySection />
          </div>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivities.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No activities logged yet. Your recent workouts will appear here
                  once you start logging them.
                </p>
              )}

              {recentActivities.map((entry: (typeof recentActivities)[number]) =>
                entry.challenge ? (
                  <div
                    key={entry.activity.id}
                    className="flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm"
                  >
                    <UserAvatar
                      user={{
                        id: user._id,
                        name: user.name ?? null,
                        username: user.username ?? null,
                        avatarUrl: user.avatarUrl ?? null,
                      }}
                      size="md"
                    />
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-foreground">
                        {entry.challenge.name}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.activity.pointsEarned.toFixed(2)} pts ·{" "}
                        {formatDistanceToNow(new Date(entry.activity.loggedDate), {
                          addSuffix: true,
                        })}
                      </p>
                      {entry.activity.notes && (
                        <p className="text-xs text-muted-foreground">
                          {entry.activity.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function ProfileHighlight({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border bg-white/70 px-6 py-4 shadow-sm">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
