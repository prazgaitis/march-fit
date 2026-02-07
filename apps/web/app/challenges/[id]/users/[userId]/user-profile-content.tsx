"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Activity,
  Calendar,
  Flame,
  Loader2,
  Medal,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { UserMiniGames } from "@/components/mini-games";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StravaConnectButton } from "@/components/integrations/strava-connect-button";
import { cn } from "@/lib/utils";

interface UserProfileContentProps {
  challengeId: string;
  profileUserId: string;
}

export function UserProfileContent({
  challengeId,
  profileUserId,
}: UserProfileContentProps) {
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);

  const profileData = useQuery(api.queries.users.getProfile, {
    userId: profileUserId as Id<"users">,
    challengeId: challengeId as Id<"challenges">,
  });

  const followData = useQuery(api.queries.follows.getProfileFollowData, {
    userId: profileUserId as Id<"users">,
  });

  const integrations = useQuery(
    api.queries.integrations.getByUser,
    followData?.isOwnProfile
      ? { userId: profileUserId as Id<"users"> }
      : "skip"
  );

  const toggleFollow = useMutation(api.mutations.follows.toggle);

  const handleToggleFollow = async () => {
    if (isTogglingFollow) return;
    setIsTogglingFollow(true);
    try {
      await toggleFollow({ userId: profileUserId as Id<"users"> });
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    } finally {
      setIsTogglingFollow(false);
    }
  };

  if (profileData === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileData === null) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>User not found</CardTitle>
          <CardDescription>
            This user may not exist or is not part of this challenge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/challenges/${challengeId}/dashboard`}>
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { user, challenge, participation, stats } = profileData;
  const hasStrava = integrations?.some(
    (integration: { service: string; revoked: boolean; accessToken?: string }) =>
      integration.service === "strava" &&
      integration.revoked === false &&
      integration.accessToken
  );
  const showStravaCard = followData?.isOwnProfile && integrations && !hasStrava;
  const profilePath = `/challenges/${challengeId}/users/${profileUserId}`;
  const errorUrl = `${profilePath}?error=strava_auth_failed`;

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <UserAvatar user={user} size="2xl" />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {user.name ?? user.username}
                  </h2>
                  <p className="text-muted-foreground">@{user.username}</p>
                </div>

                {/* Follow Button */}
                {followData && !followData.isOwnProfile && (
                  <Button
                    variant={followData.isFollowing ? "outline" : "default"}
                    size="sm"
                    onClick={handleToggleFollow}
                    disabled={isTogglingFollow}
                    className="min-w-[100px]"
                  >
                    {isTogglingFollow ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : followData.isFollowing ? (
                      <>
                        <UserMinus className="mr-2 h-4 w-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Follower/Following Counts */}
              {followData && (
                <div className="mt-3 flex justify-center gap-4 text-sm sm:justify-start">
                  <span>
                    <strong>{followData.followersCount}</strong>{" "}
                    <span className="text-muted-foreground">
                      {followData.followersCount === 1 ? "follower" : "followers"}
                    </span>
                  </span>
                  <span>
                    <strong>{followData.followingCount}</strong>{" "}
                    <span className="text-muted-foreground">following</span>
                  </span>
                </div>
              )}

              {participation ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge variant="secondary">
                    <Users className="mr-1 h-3 w-3" />
                    Participant
                  </Badge>
                  {participation.rank && participation.rank <= 3 && (
                    <Badge
                      variant="default"
                      className={cn(
                        participation.rank === 1 &&
                          "bg-yellow-500 text-yellow-950",
                        participation.rank === 2 &&
                          "bg-gray-400 text-gray-950",
                        participation.rank === 3 &&
                          "bg-amber-600 text-amber-950"
                      )}
                    >
                      <Medal className="mr-1 h-3 w-3" />
                      {participation.rank === 1 && "1st Place"}
                      {participation.rank === 2 && "2nd Place"}
                      {participation.rank === 3 && "3rd Place"}
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="mt-3">
                  Not participating
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showStravaCard && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Strava</CardTitle>
            <CardDescription>
              Link your Strava account to auto-import workouts for this challenge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StravaConnectButton successUrl={profilePath} errorUrl={errorUrl} />
            <Button asChild variant="ghost" className="w-full">
              <Link href="/integrations">Manage integrations</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {participation && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-full bg-yellow-500/10 p-3">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {participation.totalPoints.toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Points</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-full bg-orange-500/10 p-3">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {participation.currentStreak}
                </p>
                <p className="text-sm text-muted-foreground">Day Streak</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Medal className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  #{participation.rank ?? "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  of {participation.totalParticipants}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-full bg-green-500/10 p-3">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalActivities}</p>
                <p className="text-sm text-muted-foreground">Activities</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mini-Games */}
      <UserMiniGames challengeId={challengeId} userId={profileUserId} />

      {/* Participation Info */}
      {participation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Challenge Participation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Joined {format(new Date(participation.joinedAt), "MMMM d, yyyy")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activities</CardTitle>
          <CardDescription>Latest activities in {challenge.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentActivities.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivities.map((activity: { _id: string; activityTypeName: string; loggedDate: number; pointsEarned: number; createdAt: number }) => (
                <Link
                  key={activity._id}
                  href={`/challenges/${challengeId}/activities/${activity._id}`}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <p className="font-medium">{activity.activityTypeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      +{activity.pointsEarned.toFixed(0)} pts
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activities logged yet.
            </p>
          )}

          {stats.totalActivities > 5 && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/challenges/${challengeId}/users/${profileUserId}/activities`}
                >
                  View all {stats.totalActivities} activities
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
