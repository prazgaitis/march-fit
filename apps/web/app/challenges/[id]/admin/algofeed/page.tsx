"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Eye } from "lucide-react";

import { AdminCard } from "@/components/ui/admin-card";
import { SectionHeader } from "@/components/ui/section-header";

// Defaults matching feedScoring.ts
const DEFAULTS = {
  followBoost: 15,
  maxAffinityBoost: 20,
  maxAffinityScore: 100,
  scoreDampening: 1,
};

function formatAge(createdAt: number): string {
  const hours = (Date.now() - createdAt) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

type FeedRow = {
  activityId: string;
  createdAt: number;
  pointsEarned: number;
  source: string | null;
  user: { name: string | null; username: string };
  activityType: { name: string } | null;
  debug: {
    feedScore: number;
    isFollowingAuthor: boolean;
    affinityScore: number;
    [key: string]: unknown;
  };
};

function recomputeRows(
  rows: FeedRow[],
  params: typeof DEFAULTS,
): Array<
  FeedRow & {
    sim: {
      dampened: number;
      followBoost: number;
      affinityBoost: number;
      displayScore: number;
    };
  }
> {
  return rows
    .map((row) => {
      const followBoost = row.debug.isFollowingAuthor ? params.followBoost : 0;
      const clampedAff = Math.min(
        params.maxAffinityScore,
        row.debug.affinityScore,
      );
      const affinityBoost =
        row.debug.affinityScore > 0
          ? (clampedAff / params.maxAffinityScore) * params.maxAffinityBoost
          : 0;
      const dampened =
        params.scoreDampening === 1
          ? row.debug.feedScore
          : Math.pow(Math.max(0, row.debug.feedScore), params.scoreDampening);
      const displayScore = dampened + followBoost + affinityBoost;
      return {
        ...row,
        sim: {
          dampened,
          followBoost,
          affinityBoost,
          displayScore,
        },
      };
    })
    .sort((a, b) => b.sim.displayScore - a.sim.displayScore);
}

export default function AdminAlgorithmicFeedPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = params.id as string;
  const viewAsUserId = searchParams.get("viewAs");

  const [tuning, setTuning] = useState(DEFAULTS);

  const monitoring = useQuery(api.queries.admin.getMonitoringDashboard, {
    challengeId: challengeId as Id<"challenges">,
    viewAsUserId: viewAsUserId ? (viewAsUserId as Id<"users">) : undefined,
    feedLimit: 150,
    includeFeedDebug: true,
  });

  const computedRows = useMemo(() => {
    if (!monitoring?.feed?.rows) return [];
    return recomputeRows(monitoring.feed.rows as FeedRow[], tuning);
  }, [monitoring?.feed?.rows, tuning]);

  const isDefault =
    tuning.followBoost === DEFAULTS.followBoost &&
    tuning.maxAffinityBoost === DEFAULTS.maxAffinityBoost &&
    tuning.scoreDampening === DEFAULTS.scoreDampening;

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
      {/* Tuning controls */}
      <AdminCard
        header={<SectionHeader size="md">Tuning Parameters</SectionHeader>}
      >
        <div className="flex flex-wrap items-end gap-4 text-xs">
          <label className="space-y-1">
            <span className="text-zinc-500">Follow boost</span>
            <input
              type="number"
              value={tuning.followBoost}
              onChange={(e) =>
                setTuning((t) => ({
                  ...t,
                  followBoost: Number(e.target.value),
                }))
              }
              className="block w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-zinc-500">Max affinity boost</span>
            <input
              type="number"
              value={tuning.maxAffinityBoost}
              onChange={(e) =>
                setTuning((t) => ({
                  ...t,
                  maxAffinityBoost: Number(e.target.value),
                }))
              }
              className="block w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-zinc-500">Score dampening</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={tuning.scoreDampening}
              onChange={(e) =>
                setTuning((t) => ({
                  ...t,
                  scoreDampening: Number(e.target.value),
                }))
              }
              className="block w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-100"
            />
          </label>
          {!isDefault && (
            <button
              type="button"
              onClick={() => setTuning(DEFAULTS)}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-zinc-100"
            >
              Reset
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          Changes recompute the feed client-side. Formula: display =
          feedScore^dampening + followBoost + affinityBoost
        </p>
      </AdminCard>

      {/* Feed table */}
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
                {monitoring.viewAsCandidates.map(
                  (candidate: {
                    id: string;
                    name: string | null;
                    username: string;
                  }) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name || candidate.username} (@
                      {candidate.username})
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        }
        padding="none"
      >
        <div className="border-b border-zinc-800/60 px-3 py-2 text-[11px] text-zinc-500">
          Viewing as{" "}
          <span className="font-medium text-zinc-300">
            {monitoring.feed.viewer.name || monitoring.feed.viewer.username}
          </span>{" "}
          ({monitoring.feed.viewer.email}) · Following{" "}
          {monitoring.feed.followingCount} users
          {!isDefault && (
            <span className="ml-2 text-amber-400">(custom params)</span>
          )}
        </div>
        <div className="max-h-[70dvh] overflow-auto">
          {computedRows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-600">
              No feed-ranked activities found yet. Run feed score backfill
              first.
            </div>
          ) : (
            <table className="w-full min-w-[800px] text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">Activity</th>
                  <th className="px-2 py-2 text-right font-medium">Age</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Content+Eng
                  </th>
                  <th className="px-2 py-2 text-right font-medium">+Follow</th>
                  <th className="px-2 py-2 text-right font-medium">
                    +Affinity
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    = Display
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {computedRows.map((row, index) => (
                  <tr key={row.activityId} className="hover:bg-zinc-900/80">
                    <td className="px-2 py-2 text-zinc-600 font-mono">
                      {index + 1}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="font-medium text-zinc-200">
                        {row.user.name || row.user.username}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {row.activityType?.name ?? "?"} ·{" "}
                        {row.pointsEarned.toFixed(1)} pts
                        {row.debug.isFollowingAuthor && (
                          <span className="ml-1 text-blue-400">
                            ★ following
                          </span>
                        )}
                        {row.debug.affinityScore > 0 && (
                          <span className="ml-1 text-purple-400">
                            aff={row.debug.affinityScore.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {row.source ?? "manual"}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-zinc-400">
                      {formatAge(row.createdAt)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-zinc-300">
                      {row.sim.dampened.toFixed(1)}
                      {tuning.scoreDampening !== 1 && (
                        <div className="text-[10px] text-zinc-600">
                          raw {row.debug.feedScore.toFixed(1)}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {row.sim.followBoost > 0 ? (
                        <span className="text-blue-400">
                          +{row.sim.followBoost.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-zinc-700">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {row.sim.affinityBoost > 0 ? (
                        <span className="text-purple-400">
                          +{row.sim.affinityBoost.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-zinc-700">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-amber-300">
                      {row.sim.displayScore.toFixed(1)}
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
