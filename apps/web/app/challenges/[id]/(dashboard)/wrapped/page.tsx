"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { WrappedViewer } from "@/components/wrapped/wrapped-viewer";
import { FinalStandingSlide } from "@/components/wrapped/slides/final-standing";
import { ActivityVolumeSlide } from "@/components/wrapped/slides/activity-volume";
import { StreakSlide } from "@/components/wrapped/slides/streak";
import { FavoriteActivitySlide } from "@/components/wrapped/slides/favorite-activity";
import { DistanceTimeSlide } from "@/components/wrapped/slides/distance-time";
import { PrDaySlide } from "@/components/wrapped/slides/pr-day";
import { WeeklyProgressionSlide } from "@/components/wrapped/slides/weekly-progression";
import { CategoryBreakdownSlide } from "@/components/wrapped/slides/category-breakdown";
import { BiggestFanSlide } from "@/components/wrapped/slides/biggest-fan";
import { MiniGamesSlide } from "@/components/wrapped/slides/mini-games";
import { AchievementsSlide } from "@/components/wrapped/slides/achievements";
import { CommunityTotalsSlide } from "@/components/wrapped/slides/community-totals";
import { CategoryLeadersSlide } from "@/components/wrapped/slides/category-leaders";
import { Top10LeaderboardSlide } from "@/components/wrapped/slides/top-10-leaderboard";
import { ThankYouSlide } from "@/components/wrapped/slides/thank-you";

export default function WrappedPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const challengeId = params.id as string;
  const previewUserId = searchParams.get("preview");

  // Admin preview: use getWrappedPreview (bypasses wrappedEnabled check)
  // Participant: use getWrappedData (requires wrappedEnabled)
  const previewData = useQuery(
    api.queries.wrapped.getWrappedPreview,
    previewUserId
      ? {
          challengeId: challengeId as Id<"challenges">,
          userId: previewUserId as Id<"users">,
        }
      : "skip"
  );

  const participantData = useQuery(
    api.queries.wrapped.getWrappedData,
    previewUserId
      ? "skip"
      : { challengeId: challengeId as Id<"challenges"> }
  );

  const data = previewUserId ? previewData : participantData;

  if (data === undefined) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <p className="text-sm text-zinc-500">Wrapped is not available yet.</p>
      </div>
    );
  }

  // Build slides, skipping empty ones
  const slides: Array<{ key: string; content: React.ReactNode }> = [];

  // 1. Final Standing
  slides.push({
    key: "final-standing",
    content: (
      <FinalStandingSlide
        totalPoints={data.totalPoints}
        rank={data.rank}
        totalParticipants={data.totalParticipants}
        challengeName={data.challengeName}
        winners={data.winners}
      />
    ),
  });

  // 2. Activity Volume
  if (data.totalActivities > 0) {
    slides.push({
      key: "activity-volume",
      content: (
        <ActivityVolumeSlide totalActivities={data.totalActivities} />
      ),
    });
  }

  // 3. Streak
  if (data.currentStreak > 0) {
    slides.push({
      key: "streak",
      content: <StreakSlide currentStreak={data.currentStreak} />,
    });
  }

  // 4. Favorite Activity
  if (data.favoriteActivity) {
    slides.push({
      key: "favorite-activity",
      content: (
        <FavoriteActivitySlide
          favoriteActivity={data.favoriteActivity}
          activityVariety={data.activityVariety}
        />
      ),
    });
  }

  // 5. Distance + Time
  if (data.totalDistanceMiles > 0 || data.totalMinutes > 0) {
    slides.push({
      key: "distance-time",
      content: (
        <DistanceTimeSlide
          totalDistanceMiles={data.totalDistanceMiles}
          totalMinutes={data.totalMinutes}
          totalElevationMeters={data.totalElevationMeters}
        />
      ),
    });
  }

  // 6. PR Day
  if (data.prDay) {
    slides.push({
      key: "pr-day",
      content: <PrDaySlide prDay={data.prDay} />,
    });
  }

  // 7. Weekly Progression
  if (data.weeklyPoints.length > 1) {
    slides.push({
      key: "weekly-progression",
      content: (
        <WeeklyProgressionSlide weeklyPoints={data.weeklyPoints} />
      ),
    });
  }

  // 8. Category Breakdown
  if (data.categoryBreakdown.length > 1) {
    slides.push({
      key: "category-breakdown",
      content: (
        <CategoryBreakdownSlide categoryBreakdown={data.categoryBreakdown} />
      ),
    });
  }

  // 9. Biggest Fan
  if (data.biggestFan || data.yourFavorite) {
    slides.push({
      key: "biggest-fan",
      content: (
        <BiggestFanSlide
          biggestFan={data.biggestFan}
          yourFavorite={data.yourFavorite}
        />
      ),
    });
  }

  // 10. Mini-Games
  if (data.miniGameResults.length > 0) {
    slides.push({
      key: "mini-games",
      content: <MiniGamesSlide miniGameResults={data.miniGameResults} />,
    });
  }

  // 11. Achievements + Badges
  if (data.achievementsEarned.length > 0 || data.badgesEarned.length > 0) {
    slides.push({
      key: "achievements",
      content: (
        <AchievementsSlide
          achievementsEarned={data.achievementsEarned}
          badgesEarned={data.badgesEarned}
        />
      ),
    });
  }

  // 12. Community Totals
  if (data.communityTotals.totalPoints > 0) {
    slides.push({
      key: "community-totals",
      content: (
        <CommunityTotalsSlide
          communityTotals={data.communityTotals}
          userTotalMinutes={data.totalMinutes}
          userTotalMiles={data.totalDistanceMiles}
          userTotalElevation={data.totalElevationMeters}
        />
      ),
    });
  }

  // 13. Category Leaders
  if (data.categoryLeaders.length > 0) {
    slides.push({
      key: "category-leaders",
      content: (
        <CategoryLeadersSlide categoryLeaders={data.categoryLeaders} />
      ),
    });
  }

  // 14. Top 10 Leaderboard
  if (data.top10.length > 0) {
    slides.push({
      key: "top-10",
      content: <Top10LeaderboardSlide top10={data.top10} />,
    });
  }

  // 15. Thank You (always last)
  slides.push({
    key: "thank-you",
    content: (
      <ThankYouSlide
        userName={data.userName}
        challengeName={data.challengeName}
        totalPoints={data.totalPoints}
        rank={data.rank}
      />
    ),
  });

  return (
    <WrappedViewer
      slides={slides}
      challengeId={challengeId}
      activityPhotoIds={data.activityPhotoIds}
    />
  );
}
