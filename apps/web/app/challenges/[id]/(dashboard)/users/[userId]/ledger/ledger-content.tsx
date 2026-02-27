"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowLeft, Flame, Loader2, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PointsDisplay } from "@/components/ui/points-display";
import { cn } from "@/lib/utils";

interface LedgerContentProps {
  challengeId: string;
  profileUserId: string;
}

export function LedgerContent({
  challengeId,
  profileUserId,
}: LedgerContentProps) {
  const ledger = useQuery(api.queries.users.getLedger, {
    userId: profileUserId as Id<"users">,
    challengeId: challengeId as Id<"challenges">,
  });

  if (ledger === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ledger === null) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Ledger not found</CardTitle>
          <CardDescription>
            This user may not be participating in this challenge.
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

  const { user, challenge, totalPoints, totalActivityPoints, totalStreakBonus, days } = ledger;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/challenges/${challengeId}/users/${profileUserId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Points Ledger</h1>
          <p className="text-sm text-muted-foreground">
            {user.name ?? user.username} &middot; {challenge.name}
          </p>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Activities</p>
              <PointsDisplay
                points={totalActivityPoints}
                size="lg"
                showSign={false}
                showLabel={false}
                className="font-bold"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                <Flame className="mr-1 inline h-3.5 w-3.5 text-orange-500" />
                Streaks
              </p>
              <PointsDisplay
                points={totalStreakBonus}
                size="lg"
                showSign={false}
                showLabel={false}
                className="font-bold text-orange-500"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                <Trophy className="mr-1 inline h-3.5 w-3.5 text-yellow-500" />
                Total
              </p>
              <PointsDisplay
                points={totalPoints}
                size="lg"
                showSign={false}
                showLabel={false}
                className="font-bold"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day-by-day breakdown */}
      {days.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No activities logged yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {days.map((day: LedgerDay) => (
            <DayCard key={day.date} day={day} challengeId={challengeId} />
          ))}
        </div>
      )}
    </div>
  );
}

type LedgerDay = {
  date: string;
  streakBonus: number;
  activityPoints: number;
  dayTotal: number;
  activities: Array<{
    id: string;
    activityTypeName: string;
    isNegative: boolean;
    pointsEarned: number;
    triggeredBonuses?: Array<{ description: string; bonusPoints: number }>;
    notes?: string | null;
    metrics?: Record<string, unknown>;
  }>;
};

function DayCard({
  day,
  challengeId,
}: {
  day: LedgerDay;
  challengeId: string;
}) {
  const dateObj = new Date(`${day.date}T00:00:00Z`);
  const hasStreak = day.streakBonus > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {format(dateObj, "EEEE, MMM d")}
          </CardTitle>
          <PointsDisplay
            points={day.dayTotal}
            size="sm"
            showSign
            showLabel
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {day.activities.map((activity) => (
          <Link
            key={activity.id}
            href={`/challenges/${challengeId}/activities/${activity.id}`}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">{activity.activityTypeName}</span>
              {activity.triggeredBonuses && activity.triggeredBonuses.length > 0 && (
                <span className="ml-2 text-xs text-amber-500">
                  {activity.triggeredBonuses.map((b) => b.description).join(", ")}
                </span>
              )}
            </div>
            <PointsDisplay
              points={activity.pointsEarned}
              isNegative={activity.isNegative}
              size="sm"
              showSign
              showLabel={false}
              hasBonuses={
                (activity.triggeredBonuses?.length ?? 0) > 0
              }
            />
          </Link>
        ))}

        {hasStreak && (
          <div className="flex items-center justify-between rounded-md bg-orange-500/5 px-2 py-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-orange-500">
              <Flame className="h-3.5 w-3.5" />
              Day {day.streakBonus} streak bonus
            </span>
            <span className="font-semibold text-orange-500">
              +{day.streakBonus}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
