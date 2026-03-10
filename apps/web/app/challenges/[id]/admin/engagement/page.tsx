"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Heart,
  MessageCircle,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

import { AdminCard } from "@/components/ui/admin-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";

type HourlyBucket = { hour: number; label: string; count: number };

type FollowNetworkNode = {
  userId: string;
  name: string;
  username: string;
  followers: number;
  following: number;
};

type FeedRow = {
  activityId: string;
  createdAt: number;
  loggedDate: number;
  pointsEarned: number;
  feedScore: number;
  feedRank: number;
  source: string;
  hasMedia: boolean;
  hasNotes: boolean;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  user: { id: string; name: string | null; username: string };
  activityTypeName: string;
};

function HourlyBarChart({
  data,
  color,
  label,
}: {
  data: HourlyBucket[];
  color: string;
  label: string;
}) {
  const max = useMemo(
    () => data.reduce((m, b) => Math.max(m, b.count), 0),
    [data],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-mono">UTC hours</span>
      </div>
      <div className="flex h-32 items-end gap-0.5 rounded border border-zinc-800/80 bg-zinc-900/40 p-2">
        {data.map((bucket, index) => {
          const heightPct = max > 0 ? (bucket.count / max) * 100 : 0;
          return (
            <div
              key={bucket.hour}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5"
            >
              <div
                title={`${bucket.label} UTC: ${bucket.count}`}
                className={`w-full rounded-sm transition-colors ${color}`}
                style={{
                  height: `${heightPct}%`,
                  minHeight: bucket.count > 0 ? 2 : 0,
                }}
              />
              <span className="font-mono text-[8px] text-zinc-600">
                {index % 4 === 0 ? bucket.label.slice(0, 2) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatAge(createdAt: number): string {
  const hours = (Date.now() - createdAt) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function EngagementMissionControlPage() {
  const params = useParams();
  const challengeId = params.id as string;
  const [feedPage, setFeedPage] = useState(0);
  const pageSize = 50;

  const data = useQuery(api.queries.admin.getEngagementDashboard, {
    challengeId: challengeId as Id<"challenges">,
    feedPageSize: pageSize,
    feedCursor: feedPage * pageSize,
  });

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Authorizing admin access...
      </div>
    );
  }

  const totalFeedPages = Math.ceil(data.feedTotal / pageSize);
  const networkDensity =
    data.stats.totalParticipants > 1
      ? (
          (data.stats.totalIntraChallengeFollows /
            (data.stats.totalParticipants *
              (data.stats.totalParticipants - 1))) *
          100
        ).toFixed(1)
      : "0";

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="ACTIVITIES"
          value={data.stats.totalActivities}
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="LIKES"
          value={data.stats.totalLikes}
          icon={Heart}
          color="red"
          subtext={data.stats.likeScanCapped ? "capped scan" : undefined}
        />
        <StatCard
          label="COMMENTS"
          value={data.stats.totalComments}
          icon={MessageCircle}
          color="purple"
          subtext={data.stats.commentScanCapped ? "capped scan" : undefined}
        />
        <StatCard
          label="FOLLOWS"
          value={data.stats.totalIntraChallengeFollows}
          icon={Users}
          color="cyan"
          subtext={`${networkDensity}% density`}
        />
        <StatCard
          label="LIKES/ACTIVITY"
          value={
            data.stats.totalActivities > 0
              ? (data.stats.totalLikes / data.stats.totalActivities).toFixed(1)
              : "0"
          }
          icon={Heart}
          color="amber"
        />
        <StatCard
          label="COMMENTS/ACTIVITY"
          value={
            data.stats.totalActivities > 0
              ? (
                  data.stats.totalComments / data.stats.totalActivities
                ).toFixed(1)
              : "0"
          }
          icon={MessageCircle}
          color="orange"
        />
      </div>

      {/* Scan cap warning */}
      {(data.stats.likeScanCapped || data.stats.commentScanCapped) && (
        <div className="flex items-center gap-2 rounded border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Engagement scan capped at 8,000 records to protect the database.
            Totals may be approximate.
          </span>
        </div>
      )}

      {/* Hourly charts grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard
          header={
            <SectionHeader size="md">Activities by Hour (UTC)</SectionHeader>
          }
          padding="sm"
        >
          <HourlyBarChart
            data={data.activityHourlyCounts}
            color="bg-blue-500/70 hover:bg-blue-400"
            label={`${data.stats.totalActivities} activities`}
          />
        </AdminCard>

        <AdminCard
          header={
            <SectionHeader size="md">Likes by Hour (UTC)</SectionHeader>
          }
          padding="sm"
        >
          <HourlyBarChart
            data={data.likeHourlyCounts}
            color="bg-red-500/70 hover:bg-red-400"
            label={`${data.stats.totalLikes} likes`}
          />
        </AdminCard>

        <AdminCard
          header={
            <SectionHeader size="md">Comments by Hour (UTC)</SectionHeader>
          }
          padding="sm"
        >
          <HourlyBarChart
            data={data.commentHourlyCounts}
            color="bg-purple-500/70 hover:bg-purple-400"
            label={`${data.stats.totalComments} comments`}
          />
        </AdminCard>

        <AdminCard
          header={
            <SectionHeader size="md">Follows by Hour (UTC)</SectionHeader>
          }
          padding="sm"
        >
          <HourlyBarChart
            data={data.followHourlyCounts}
            color="bg-cyan-500/70 hover:bg-cyan-400"
            label={`${data.stats.totalIntraChallengeFollows} follows`}
          />
        </AdminCard>
      </div>

      {/* Follow network */}
      <AdminCard
        header={
          <div className="flex items-center justify-between">
            <SectionHeader size="md">Follow Network</SectionHeader>
            <span className="text-xs text-zinc-500">
              {data.stats.totalIntraChallengeFollows} connections /{" "}
              {data.stats.totalParticipants} participants / {networkDensity}%
              density
            </span>
          </div>
        }
        padding="none"
      >
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">User</th>
                <th className="px-3 py-2 text-right font-medium">Followers</th>
                <th className="px-3 py-2 text-right font-medium">Following</th>
                <th className="px-3 py-2 text-right font-medium">Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {data.followNetwork.map((node: FollowNetworkNode, index: number) => (
                <tr key={node.userId} className="hover:bg-zinc-900/80">
                  <td className="px-3 py-1.5 font-mono text-zinc-600">
                    {index + 1}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-zinc-200">
                      {node.name || node.username}
                    </span>
                    <span className="ml-1 text-zinc-600">
                      @{node.username}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-400">
                    {node.followers}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-400">
                    {node.following}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">
                    {node.following > 0
                      ? (node.followers / node.following).toFixed(1)
                      : node.followers > 0
                        ? "inf"
                        : "-"}
                  </td>
                </tr>
              ))}
              {data.followNetwork.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-zinc-600"
                  >
                    No follow connections yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Feed score sorted activities */}
      <AdminCard
        header={
          <div className="flex items-center justify-between">
            <SectionHeader size="md">
              Activities by Feed Score
            </SectionHeader>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-mono">
                {data.feedOffset + 1}&ndash;
                {Math.min(data.feedOffset + data.feedPageSize, data.feedTotal)}{" "}
                of {data.feedTotal}
              </span>
              <button
                type="button"
                disabled={feedPage === 0}
                onClick={() => setFeedPage((p) => Math.max(0, p - 1))}
                className="rounded border border-zinc-700 p-0.5 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={feedPage >= totalFeedPages - 1}
                onClick={() => setFeedPage((p) => p + 1)}
                className="rounded border border-zinc-700 p-0.5 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        }
        padding="none"
      >
        <div className="max-h-[60dvh] overflow-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">User</th>
                <th className="px-2 py-2 text-left font-medium">Type</th>
                <th className="px-2 py-2 text-right font-medium">Points</th>
                <th className="px-2 py-2 text-right font-medium">
                  Feed Score
                </th>
                <th className="px-2 py-2 text-center font-medium">Likes</th>
                <th className="px-2 py-2 text-center font-medium">Comments</th>
                <th className="px-2 py-2 text-center font-medium">Reposts</th>
                <th className="px-2 py-2 text-center font-medium">Media</th>
                <th className="px-2 py-2 text-center font-medium">Notes</th>
                <th className="px-2 py-2 text-right font-medium">Age</th>
                <th className="px-2 py-2 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {data.feedRows.map((row: FeedRow, index: number) => (
                <tr key={row.activityId} className="hover:bg-zinc-900/80">
                  <td className="px-2 py-1.5 font-mono text-zinc-600">
                    {data.feedOffset + index + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="text-zinc-200">
                      {row.user.name || row.user.username}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-zinc-400">
                    {row.activityTypeName}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-400">
                    {row.pointsEarned.toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-amber-300">
                    {row.feedScore.toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">
                    {row.likeCount > 0 ? (
                      <span className="text-red-400">{row.likeCount}</span>
                    ) : (
                      <span className="text-zinc-700">0</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">
                    {row.commentCount > 0 ? (
                      <span className="text-purple-400">
                        {row.commentCount}
                      </span>
                    ) : (
                      <span className="text-zinc-700">0</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">
                    {row.repostCount > 0 ? (
                      <span className="text-blue-400">{row.repostCount}</span>
                    ) : (
                      <span className="text-zinc-700">0</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {row.hasMedia ? (
                      <span className="text-amber-400">Y</span>
                    ) : (
                      <span className="text-zinc-700">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {row.hasNotes ? (
                      <span className="text-amber-400">Y</span>
                    ) : (
                      <span className="text-zinc-700">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                    {formatAge(row.createdAt)}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-500">
                    {row.source}
                  </td>
                </tr>
              ))}
              {data.feedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-6 text-center text-zinc-600"
                  >
                    No activities with feed scores. Run feed score backfill
                    first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
