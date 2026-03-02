"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Doc, Id } from "@repo/backend/_generated/dataModel";
import { dateOnlyToUtcMs, formatDateShortFromDateOnly } from "@/lib/date-only";
import {
  Activity,
  AlertTriangle,
  Flag,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { AdminCard } from "@/components/ui/admin-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";

type LeaderboardEntry = {
  participantId: Id<"userChallenges">;
  user: {
    name?: string;
    username: string;
    avatarUrl?: string;
  };
  totalPoints: number;
  currentStreak: number;
};

export default function AdminOverviewPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const dashboardData = useQuery(api.queries.challenges.getDashboardData, {
    challengeId: challengeId as Id<"challenges">,
  });

  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });

  const monitoring = useQuery(api.queries.admin.getMonitoringDashboard, {
    challengeId: challengeId as Id<"challenges">,
    feedLimit: 10,
    includeFeedDebug: false,
  });

  const maxBucketCount = useMemo(
    () =>
      (monitoring?.hourlyCounts ?? []).reduce((max: number, bucket: { count: number }) => {
        return Math.max(max, bucket.count);
      }, 0),
    [monitoring?.hourlyCounts],
  );
  const activityTypeCountMap = useMemo(
    () =>
      new Map<string, number>(
        (monitoring?.activityTypeCounts ?? []).map(
          (entry: { activityTypeId: string; count: number }) => [
            entry.activityTypeId,
            entry.count,
          ],
        ),
      ),
    [monitoring?.activityTypeCounts],
  );

  if (!dashboardData || !monitoring) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  const { challenge, stats, leaderboard } = dashboardData;

  const topPerformers = leaderboard.slice(0, 5);
  const avgPoints = leaderboard.length > 0
    ? leaderboard.reduce((sum: number, p: LeaderboardEntry) => sum + p.totalPoints, 0) / leaderboard.length
    : 0;

  const startDateMs = dateOnlyToUtcMs(challenge.startDate);
  const endDateMs = dateOnlyToUtcMs(challenge.endDate);
  const daysElapsed = Math.max(0, Math.ceil((Date.now() - startDateMs) / (1000 * 60 * 60 * 24)));
  const totalDays = Math.ceil((endDateMs - startDateMs) / (1000 * 60 * 60 * 24));
  const progressPct = Math.min(100, (daysElapsed / totalDays) * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="PARTICIPANTS" value={stats.totalParticipants} icon={Users} color="emerald" />
        <StatCard label="ACTIVITIES" value={stats.totalActivities} icon={Activity} color="blue" />
        <StatCard label="TOTAL POINTS" value={Math.round(stats.totalPoints)} icon={TrendingUp} color="amber" />
        <StatCard label="AVG POINTS" value={avgPoints.toFixed(1)} icon={Zap} color="purple" />
        <StatCard label="ACTIVITY TYPES" value={activityTypes?.length ?? 0} icon={Flag} color="cyan" />
        <StatCard label="DAYS ELAPSED" value={`${daysElapsed}/${totalDays}`} icon={AlertTriangle} color="zinc" />
      </div>

      <AdminCard padding="sm">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Challenge Progress</span>
          <span className="font-mono text-zinc-300">{progressPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
          <span>{formatDateShortFromDateOnly(challenge.startDate)}</span>
          <span>{formatDateShortFromDateOnly(challenge.endDate)}</span>
        </div>
      </AdminCard>

      <AdminCard header={<SectionHeader size="md">Activity Volume by Created Hour (UTC)</SectionHeader>} padding="sm">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>{monitoring.totalActivities} non-deleted activities</span>
          <span className="font-mono">UTC hours</span>
        </div>
        <div className="flex h-44 items-end gap-1 rounded border border-zinc-800/80 bg-zinc-900/40 p-2">
          {monitoring.hourlyCounts.map((bucket: (typeof monitoring.hourlyCounts)[number], index: number) => {
            const heightPct =
              maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0;
            return (
              <div key={bucket.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div
                  title={`${bucket.label} UTC: ${bucket.count} activities`}
                  className="w-full rounded-sm bg-amber-500/70 transition-colors hover:bg-amber-400"
                  style={{ height: `${heightPct}%`, minHeight: bucket.count > 0 ? 2 : 0 }}
                />
                <span className="font-mono text-[9px] text-zinc-600">
                  {index % 3 === 0 ? bucket.label.slice(0, 2) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard header={<SectionHeader size="md">Top Performers</SectionHeader>} padding="none">
          <div className="divide-y divide-zinc-800/50">
            {topPerformers.length > 0 ? (
              topPerformers.map((entry: LeaderboardEntry, index: number) => (
                <div
                  key={entry.participantId}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 font-mono text-xs text-zinc-600">{index + 1}.</span>
                    <span className="text-sm text-zinc-200">{entry.user.name || entry.user.username}</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span className="text-emerald-400">{entry.totalPoints.toFixed(1)} pts</span>
                    <span className="text-zinc-500">{entry.currentStreak}d streak</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-zinc-600">No participants yet</div>
            )}
          </div>
        </AdminCard>

        <AdminCard header={<SectionHeader size="md">Activity Types</SectionHeader>} padding="none">
          <div className="max-h-64 divide-y divide-zinc-800/50 overflow-y-auto">
            {activityTypes && activityTypes.length > 0 ? (
              activityTypes.map((type: Doc<"activityTypes">) => (
                <div
                  key={type._id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div>
                    <span className="text-sm text-zinc-200">{type.name}</span>
                    <div className="font-mono text-[10px] text-zinc-500">
                      {activityTypeCountMap.get(type._id) ?? 0} logged
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {type.isNegative ? (
                      <span className="text-red-400">PENALTY</span>
                    ) : type.contributesToStreak ? (
                      <span className="text-emerald-400">STREAK</span>
                    ) : (
                      <span className="text-zinc-500">BONUS</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-zinc-600">No activity types configured</div>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
