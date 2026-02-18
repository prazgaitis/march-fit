"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityLinkCardProps {
  activityId: string;
}

export function ActivityLinkCard({ activityId }: ActivityLinkCardProps) {
  const data = useQuery(api.queries.activities.getById, {
    activityId: activityId as Id<"activities">,
  });

  if (data === undefined) {
    return (
      <div className="my-2 animate-pulse rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="h-4 w-32 rounded bg-zinc-800" />
        <div className="mt-2 h-3 w-48 rounded bg-zinc-800" />
      </div>
    );
  }

  if (data === null) {
    return null;
  }

  return (
    <Link
      href={`/challenges/${data.challenge.id}/activities/${data.activity._id}`}
      className="my-2 block rounded-md border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {data.activityType.name}
            </span>
            <span className="text-xs font-medium text-emerald-400">
              +{data.activity.pointsEarned} pts
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>by {data.user.name || data.user.username}</span>
            <span>
              {formatDistanceToNow(new Date(data.activity.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
