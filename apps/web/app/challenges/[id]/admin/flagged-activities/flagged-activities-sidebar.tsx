"use client";

import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useFlaggedList } from "./flagged-list-context";

type FlaggedActivityItem = {
  activity: {
    id: string;
    flaggedReason?: string;
    resolutionStatus: string;
    flaggedAt?: number;
    pointsEarned: number;
  };
  participant: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  activityType?: {
    id: string;
    name: string;
  } | null;
};

interface FlaggedActivitiesSidebarProps {
  challengeId: string;
}

export function FlaggedActivitiesSidebar({
  challengeId,
}: FlaggedActivitiesSidebarProps) {
  const params = useParams();
  const selectedActivityId = params.activityId as string | undefined;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("pending");

  const result = useQuery(api.queries.admin.listFlaggedActivities, {
    challengeId: challengeId as Id<"challenges">,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const items = result?.items as FlaggedActivityItem[] | undefined;
  const total = result?.total ?? 0;

  // Sync visible items to context so the detail panel can navigate them
  const { setItems } = useFlaggedList();
  useEffect(() => {
    setItems(items ?? []);
  }, [items, setItems]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold">Flagged</h2>
            {total > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                {total}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1">
          {(["pending", "resolved", "all"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {status === "pending" ? "Pending" : status === "resolved" ? "Resolved" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items === undefined ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-10 text-center text-xs text-muted-foreground">
            No flagged activities found.
          </div>
        ) : (
          <div>
            {items.map((item) => {
              const isSelected = selectedActivityId === item.activity.id;
              return (
                <Link
                  key={item.activity.id}
                  href={`/challenges/${challengeId}/admin/flagged-activities/${item.activity.id}`}
                  className={`flex gap-3 border-b border-zinc-800/50 px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "bg-zinc-800 border-l-2 border-l-amber-500"
                      : "hover:bg-zinc-900 border-l-2 border-l-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 pt-0.5">
                    <UserAvatar
                      user={{
                        id: item.participant.id,
                        name: item.participant.name ?? null,
                        username: item.participant.email ?? item.participant.name ?? "?",
                        avatarUrl: item.participant.avatarUrl ?? null,
                      }}
                      size="xs"
                      disableLink
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">
                        {item.participant.name ?? "Unknown"}
                      </span>
                      {item.activity.flaggedAt && (
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.activity.flaggedAt), {
                            addSuffix: false,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.activityType && (
                        <span className="text-[10px] font-medium text-zinc-400 truncate">
                          {item.activityType.name}
                        </span>
                      )}
                      {item.activity.resolutionStatus === "pending" ? (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                          Resolved
                        </Badge>
                      )}
                    </div>
                    {item.activity.flaggedReason && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                        {item.activity.flaggedReason}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
