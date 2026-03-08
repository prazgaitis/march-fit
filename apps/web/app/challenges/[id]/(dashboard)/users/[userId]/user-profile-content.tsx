"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { formatMonthDayFromUtcMs } from "@/lib/date-only";
import { useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Award,
  Calendar,
  ChevronRight,
  Loader2,
  MapPin,
  Medal,
  Mountain,
  Send,
  Settings,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { UserMiniGames } from "@/components/mini-games";
import { StreakCalendarCard } from "@/components/streak-calendar-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StravaConnectButton } from "@/components/integrations/strava-connect-button";
import { ApiKeySection } from "@/components/api-key-section";
import { cn } from "@/lib/utils";
import { PointsDisplay } from "@/components/ui/points-display";
import { StoryViewer } from "@/components/dashboard/story-viewer";
import { buildUserStory } from "@/lib/story-utils";
import { useOptimizedMedia } from "@/hooks/use-optimized-media";

interface UserProfileContentProps {
  challengeId: string;
  profileUserId: string;
}

export function UserProfileContent({
  challengeId,
  profileUserId,
}: UserProfileContentProps) {
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [showPrDayModal, setShowPrDayModal] = useState(false);
  const [showInvitedModal, setShowInvitedModal] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);

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
      : "skip",
  );

  // Achievements — own profile gets full progress; other profiles get earned-only list
  const ownAchievementProgress = useQuery(
    api.queries.achievements.getUserProgress,
    followData?.isOwnProfile
      ? { challengeId: challengeId as Id<"challenges"> }
      : "skip",
  );
  const theirEarnedAchievements = useQuery(
    api.queries.achievements.getEarnedByUser,
    followData?.isOwnProfile === false
      ? {
          challengeId: challengeId as Id<"challenges">,
          userId: profileUserId as Id<"users">,
        }
      : "skip",
  );

  const invitedUsers = useQuery(
    api.queries.participations.getInvitedUsers,
    showInvitedModal
      ? {
          userId: profileUserId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
        }
      : "skip",
  );

  const userStories = useQuery(api.queries.activities.getUserStories, {
    userId: profileUserId as Id<"users">,
    challengeId: challengeId as Id<"challenges">,
    limit: 20,
  });

  const toggleFollow = useMutation(api.mutations.follows.toggle);
  const showOptimized = useOptimizedMedia();

  const stories = useMemo(() => {
    if (!userStories || userStories.length === 0 || !profileData) return [];
    const u = profileData.user;
    const story = buildUserStory(
      { id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl },
      challengeId,
      userStories as any[],
      showOptimized,
    );
    return story ? [story] : [];
  }, [userStories, profileData, challengeId, showOptimized]);

  const hasStories = stories.length > 0;

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

  const { user, challenge, participation, stats, streakCalendar } = profileData;
  const prDay = stats.prDay;
  const hasStrava = integrations?.some(
    (integration: {
      service: string;
      revoked: boolean;
      accessToken?: string;
    }) =>
      integration.service === "strava" &&
      integration.revoked === false &&
      integration.accessToken,
  );
  const showStravaCard = followData?.isOwnProfile && integrations && !hasStrava;
  const profilePath = `/challenges/${challengeId}/users/${profileUserId}`;
  const errorUrl = `${profilePath}?error=strava_auth_failed`;

  return (
    <div>
      {/* User Info */}
      <div className="px-4 py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <UserAvatar
            user={user}
            size="2xl"
            hasStory={hasStories}
            onAvatarClick={hasStories ? () => setStoryViewerOpen(true) : undefined}
          />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {user.name ?? user.username}
                </h2>
                <p className="text-muted-foreground">@{user.username}</p>
                {user.location && (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {user.location}
                  </p>
                )}
              </div>

              {/* Settings Button (own profile) or Follow Button */}
              {followData &&
                (followData.isOwnProfile ? (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="min-w-[100px]"
                  >
                    <Link href={`/challenges/${challengeId}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 sm:items-end">
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
                      ) : followData.isFollowedBy ? (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Follow back
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Follow
                        </>
                      )}
                    </Button>
                    {followData.isFollowedBy && (
                      <span className="text-xs text-muted-foreground">Follows you</span>
                    )}
                  </div>
                ))}
            </div>

            {/* Follower/Following Counts */}
            {followData && (
              <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm sm:justify-start">
                <span>
                  <strong>{followData.followersCount}</strong>{" "}
                  <span className="text-muted-foreground">
                    {followData.followersCount === 1
                      ? "follower"
                      : "followers"}
                  </span>
                </span>
                <span>
                  <strong>{followData.followingCount}</strong>{" "}
                  <span className="text-muted-foreground">following</span>
                </span>
                {participation && (participation.inviteCount ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInvitedModal(true)}
                    className="hover:underline"
                  >
                    <strong>{participation.inviteCount}</strong>{" "}
                    <span className="text-muted-foreground">
                      {participation.inviteCount === 1 ? "invite" : "invites"}
                    </span>
                  </button>
                )}
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
                      participation.rank === 2 && "bg-gray-400 text-gray-950",
                      participation.rank === 3 &&
                        "bg-amber-600 text-amber-950",
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
      </div>

      <div className="border-b border-border/50" />

      {showStravaCard && (
        <>
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Connect Strava</p>
              <p className="text-xs text-muted-foreground">
                Auto-import workouts for this challenge.
              </p>
            </div>
            <StravaConnectButton
              successUrl={profilePath}
              errorUrl={errorUrl}
              className="w-auto shrink-0"
            />
          </div>
          <div className="border-b border-border/50" />
        </>
      )}

      {/* Stats Row */}
      {participation && (
        <>
          <div className="grid grid-cols-4 divide-x divide-border/50 py-4">
            <div className="flex flex-col items-center gap-1 px-2">
              <PointsDisplay
                points={participation.totalPoints}
                size="lg"
                showSign={false}
                showLabel={false}
                className="font-bold"
              />
              <p className="text-xs text-muted-foreground">Points</p>
            </div>
            <div className="flex flex-col items-center gap-1 px-2">
              <p className="text-lg font-bold">{participation.currentStreak}</p>
              <p className="text-xs text-muted-foreground">Streak</p>
            </div>
            <div className="flex flex-col items-center gap-1 px-2">
              <p className="text-lg font-bold">#{participation.rank ?? "-"}</p>
              <p className="text-xs text-muted-foreground">
                of {participation.totalParticipants}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 px-2">
              <p className="text-lg font-bold">{stats.totalActivities}</p>
              <p className="text-xs text-muted-foreground">Activities</p>
            </div>
          </div>
          <div className="border-b border-border/50" />
        </>
      )}

      {participation && streakCalendar && (
        <>
          <div className="px-4 py-4">
            <StreakCalendarCard
              startDate={streakCalendar.startDate}
              endDate={streakCalendar.endDate}
              streakMinPoints={streakCalendar.streakMinPoints}
              dailyPoints={streakCalendar.dailyPoints}
              dailyStreakCount={streakCalendar.dailyStreakCount}
              totalStreakBonusPoints={streakCalendar.totalStreakBonusPoints}
            />
          </div>
          <div className="border-b border-border/50" />
        </>
      )}

      {participation && (
        <>
          <button
            type="button"
            onClick={() => {
              if (prDay) {
                setShowPrDayModal(true);
              }
            }}
            className={cn(
              "w-full text-left",
              prDay ? "cursor-pointer" : "cursor-default",
            )}
            disabled={!prDay}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-4",
                prDay && "transition-colors hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-violet-500/10 p-2.5">
                  <Mountain className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PR Day</p>
                  {prDay ? (
                    <p className="font-semibold">
                      {format(
                        new Date(`${prDay.date}T00:00:00Z`),
                        "MMMM d, yyyy",
                      )}
                    </p>
                  ) : (
                    <p className="font-semibold text-muted-foreground">
                      Not set yet
                    </p>
                  )}
                </div>
              </div>
              <p className="text-right font-semibold text-primary">
                {prDay ? `+${prDay.totalPoints.toFixed(0)} pts` : "-"}
              </p>
            </div>
          </button>
          <div className="border-b border-border/50" />

          <Dialog open={showPrDayModal} onOpenChange={setShowPrDayModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>PR Day Breakdown</DialogTitle>
                <DialogDescription>
                  {prDay
                    ? `${format(new Date(`${prDay.date}T00:00:00Z`), "MMMM d, yyyy")} • ${prDay.totalPoints.toFixed(0)} points`
                    : "No PR day available."}
                </DialogDescription>
              </DialogHeader>

              {prDay && (
                <div className="space-y-2">
                  {prDay.activities.map(
                    (activity: {
                      id: string;
                      activityTypeName: string;
                      pointsEarned: number;
                      createdAt: number;
                    }) => (
                      <Link
                        key={activity.id}
                        href={`/challenges/${challengeId}/activities/${activity.id}`}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40"
                        onClick={() => setShowPrDayModal(false)}
                      >
                        <div>
                          <p className="font-medium">
                            {activity.activityTypeName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <p className="font-semibold text-primary">
                          {activity.pointsEarned >= 0 ? "+" : ""}
                          {activity.pointsEarned.toFixed(2)} pts
                        </p>
                      </Link>
                    ),
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Invited Users Modal */}
      <Dialog open={showInvitedModal} onOpenChange={setShowInvitedModal}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Invited Members
            </DialogTitle>
            <DialogDescription>
              People who joined using{" "}
              {followData?.isOwnProfile
                ? "your"
                : `${user.name ?? user.username}'s`}{" "}
              invite link
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6">
            {invitedUsers === undefined ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invitedUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No invited members yet.
              </p>
            ) : (
              <div className="space-y-2">
                {invitedUsers.map(
                  (invitee: {
                    id: string;
                    username: string;
                    name: string | null;
                    avatarUrl: string | null;
                    joinedAt: number;
                  }) => (
                    <Link
                      key={invitee.id}
                      href={`/challenges/${challengeId}/users/${invitee.id}`}
                      onClick={() => setShowInvitedModal(false)}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                    >
                      <UserAvatar user={invitee} size="sm" disableLink />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {invitee.name ?? invitee.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{invitee.username}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(invitee.joinedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mini-Games */}
      <div className="px-4 py-4">
        <UserMiniGames challengeId={challengeId} userId={profileUserId} />
      </div>

      {/* ── Achievements ─────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <AchievementsSection
          ownProgress={ownAchievementProgress}
          theirEarned={theirEarnedAchievements}
          isOwnProfile={followData?.isOwnProfile ?? false}
          challengeName={challenge.name}
        />
      </div>

      {/* Participation Info */}
      {participation && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Joined{" "}
            {format(new Date(participation.joinedAt), "MMMM d, yyyy")}
          </span>
        </div>
      )}

      <div className="border-b border-border/50" />

      {/* Recent Activities */}
      <div className="py-4">
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-lg font-semibold">Recent Activities</h3>
          {stats.totalActivities > 5 && (
            <Link
              href={`/challenges/${challengeId}/users/${profileUserId}/activities`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {stats.recentActivities.length > 0 ? (
          <div>
            {stats.recentActivities.map(
              (activity: {
                _id: string;
                activityTypeName: string;
                loggedDate: number;
                pointsEarned: number;
                createdAt: number;
                isNegative?: boolean;
              }) => (
                <Link
                  key={activity._id}
                  href={`/challenges/${challengeId}/activities/${activity._id}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{activity.activityTypeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMonthDayFromUtcMs(activity.loggedDate)} ·{" "}
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PointsDisplay
                      points={activity.pointsEarned}
                      isNegative={activity.isNegative}
                      size="base"
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ),
            )}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No activities logged yet.
          </p>
        )}
      </div>

      {/* API Key Management (own profile only) */}
      {followData?.isOwnProfile && (
        <div className="px-4 py-4">
          <ApiKeySection />
        </div>
      )}

      {/* Story viewer */}
      <StoryViewer
        stories={stories}
        initialIndex={0}
        open={storyViewerOpen}
        onClose={() => setStoryViewerOpen(false)}
      />
    </div>
  );
}

// ─── Achievement progress helpers ────────────────────────────────────────────

type OwnProgressItem = {
  achievementId: string;
  name: string;
  description: string;
  bonusPoints: number;
  frequency: string;
  criteriaType: string;
  currentCount: number;
  requiredCount: number;
  isEarned: boolean;
  earnedAt?: number;
};

type EarnedItem = {
  achievementId: string;
  name: string;
  description: string;
  bonusPoints: number;
  earnedAt: number;
};

/** Format progress fraction into a human-readable label. */
function formatProgress(item: OwnProgressItem): string {
  const { criteriaType, currentCount, requiredCount } = item;
  const current = Number.isInteger(currentCount)
    ? currentCount
    : currentCount.toFixed(1);
  switch (criteriaType) {
    case "cumulative":
      return `${current} / ${requiredCount}`;
    case "distinct_types":
    case "one_of_each":
      return `${currentCount} / ${requiredCount} types`;
    case "count":
    default:
      return `${currentCount} / ${requiredCount} activities`;
  }
}

// ─── AchievementsSection component ───────────────────────────────────────────

function AchievementsSection({
  ownProgress,
  theirEarned,
  isOwnProfile,
  challengeName,
}: {
  ownProgress: OwnProgressItem[] | undefined;
  theirEarned: (EarnedItem | null)[] | undefined;
  isOwnProfile: boolean;
  challengeName: string;
}) {
  // While loading, render nothing (no jarring shift)
  if (isOwnProfile && ownProgress === undefined) return null;
  if (!isOwnProfile && theirEarned === undefined) return null;

  // ── Other user's profile: show only earned achievements ──────────────────
  if (!isOwnProfile) {
    const earned = (theirEarned ?? []).filter(Boolean) as EarnedItem[];
    if (earned.length === 0) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-amber-500" />
            Achievements
          </CardTitle>
          <CardDescription>Earned in {challengeName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {earned.map((item) => (
              <div
                key={item.achievementId}
                className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
              >
                <Award className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      +{item.bonusPoints} pts
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Earned {format(new Date(item.earnedAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Own profile: full progress view ──────────────────────────────────────
  const allProgress = ownProgress ?? [];
  if (allProgress.length === 0) return null;

  const earned = allProgress.filter((a) => a.isEarned);
  // Hide once_per_challenge achievements that are already earned from the "still available" list
  const available = allProgress.filter(
    (a) => !a.isEarned && !(a.frequency === "once_per_challenge" && a.isEarned),
  );

  const hasEarned = earned.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-amber-500" />
          Achievements
        </CardTitle>
        <CardDescription>
          {hasEarned
            ? `${earned.length} earned — keep going for more!`
            : "Earn bonus points by completing special challenges"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Earned achievements */}
        {hasEarned && (
          <div className="space-y-2">
            {earned.map((item) => (
              <div
                key={item.achievementId}
                className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
              >
                <Award className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      +{item.bonusPoints} pts
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                  {item.earnedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Earned {format(new Date(item.earnedAt), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Still available to earn */}
        {available.length > 0 && (
          <>
            {hasEarned && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                Still available to earn
              </p>
            )}
            <div className="space-y-2">
              {available.map((item) => {
                const pct =
                  item.requiredCount > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (item.currentCount / item.requiredCount) * 100,
                        ),
                      )
                    : 0;
                return (
                  <div
                    key={item.achievementId}
                    className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3"
                  >
                    <Award className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-muted-foreground">
                          {item.name}
                        </p>
                        <span className="text-xs text-muted-foreground/60">
                          +{item.bonusPoints} pts
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {item.description}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground/60">
                            {formatProgress(item)}
                          </span>
                          <span className="text-xs text-muted-foreground/50">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500/50 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
