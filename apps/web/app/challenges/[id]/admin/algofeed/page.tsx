"use client";

import { useCallback } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Eye } from "lucide-react";

import { AdminCard } from "@/components/ui/admin-card";
import { SectionHeader } from "@/components/ui/section-header";

export default function AdminAlgorithmicFeedPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = params.id as string;
  const viewAsUserId = searchParams.get("viewAs");

  const monitoring = useQuery(api.queries.admin.getMonitoringDashboard, {
    challengeId: challengeId as Id<"challenges">,
    viewAsUserId: viewAsUserId ? (viewAsUserId as Id<"users">) : undefined,
    feedLimit: 150,
    includeFeedDebug: true,
  });

  const updateViewAs = useCallback(
    (nextUserId: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextUserId) {
        nextParams.set("viewAs", nextUserId);
      } else {
        nextParams.delete("viewAs");
      }
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  if (monitoring === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  if (monitoring === null) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Authorizing admin access...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminCard
        header={
          <div className="flex items-center justify-between gap-3">
            <SectionHeader size="md">Algorithmic Feed Debug</SectionHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-zinc-500" />
              <label htmlFor="view-as" className="text-xs text-zinc-500">
                View as
              </label>
              <select
                id="view-as"
                value={monitoring.feed.viewer.id}
                onChange={(event) => updateViewAs(event.target.value)}
                className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {monitoring.viewAsCandidates.map((candidate: { id: string; name: string | null; username: string }) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name || candidate.username} (@{candidate.username})
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
        padding="none"
      >
        <div className="border-b border-zinc-800/60 px-3 py-2 text-xs text-zinc-500">
          Viewing as{" "}
          <span className="font-medium text-zinc-300">
            {monitoring.feed.viewer.name || monitoring.feed.viewer.username}
          </span>{" "}
          ({monitoring.feed.viewer.email}) · Following {monitoring.feed.followingCount} users ·
          Personalization boost per followed activity = +15
        </div>
        <div className="max-h-[70dvh] overflow-auto">
          {monitoring.feed.rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-600">
              No feed-ranked activities found yet. Run feed score backfill first.
            </div>
          ) : (
            <table className="w-full min-w-[920px] text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Activity</th>
                  <th className="px-3 py-2 text-right font-medium">Feed Score</th>
                  <th className="px-3 py-2 text-right font-medium">Affinity</th>
                  <th className="px-3 py-2 text-right font-medium">Feed Rank</th>
                  <th className="px-3 py-2 text-right font-medium">Personalized Rank</th>
                  <th className="px-3 py-2 text-right font-medium">Boost (Follow + Affinity)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {monitoring.feed.rows.map((row: (typeof monitoring.feed.rows)[number]) => (
                  <tr key={row.activityId} className="hover:bg-zinc-900/80">
                    <td className="px-3 py-2 align-top text-zinc-400">
                      <div className="font-mono text-[11px]">
                        {new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19)}Z
                      </div>
                      <div className="text-[10px] text-zinc-600">source={row.source}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-zinc-200">{row.user.name || row.user.username}</div>
                      <div className="text-[10px] text-zinc-500">
                        @{row.user.username} · {row.activityType?.name ?? "Unknown type"} · {row.pointsEarned.toFixed(1)} pts
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{row.debug.feedScore.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                      {row.debug.affinityScore.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                      {Math.round(row.debug.feedRank)}
                      <div className="text-[10px] text-zinc-600">d={row.debug.dayBucket} r={row.debug.rankInDayBucket}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300">{Math.round(row.debug.personalizedRank)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className="text-zinc-300">+{row.debug.totalBoostApplied.toFixed(1)}</span>
                      <div className="text-[10px] text-zinc-600">
                        +{row.debug.followingBoostApplied.toFixed(0)} + {row.debug.affinityBoostApplied.toFixed(1)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
