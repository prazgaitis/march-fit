"use client";

import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useFeedbackList } from "./feedback-list-context";

type FeedbackType = "bug" | "question" | "idea" | "other";
type FeedbackStatus = "open" | "fixed";

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title?: string;
  description: string;
  createdAt: number;
  reporter: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
};

const typeLabel: Record<FeedbackType, string> = {
  bug: "Bug",
  question: "Question",
  idea: "Idea",
  other: "Other",
};

interface FeedbackSidebarProps {
  challengeId: string;
}

export function FeedbackSidebar({ challengeId }: FeedbackSidebarProps) {
  const { selectedId, setSelectedId, setItems } = useFeedbackList();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "fixed">(
    "open",
  );

  const data = useQuery(api.queries.feedback.listForAdmin, {
    challengeId: challengeId as Id<"challenges">,
  }) as { items: FeedbackRow[] } | undefined;

  const allItems = data?.items ?? [];

  // Client-side filtering
  const items = allItems.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesReporter =
        item.reporter?.name?.toLowerCase().includes(q) ||
        item.reporter?.username?.toLowerCase().includes(q);
      const matchesContent =
        item.title?.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      if (!matchesReporter && !matchesContent) return false;
    }
    return true;
  });

  const total = items.length;

  // Sync visible items to context for keyboard navigation
  useEffect(() => {
    setItems(items.map((item) => ({ id: item.id })));
  }, [items, setItems]);

  // Auto-select first item when none is selected
  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [selectedId, items, setSelectedId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold">Feedback</h2>
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
          {(["open", "fixed", "all"] as const).map((status) => (
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
              {status === "open"
                ? "Open"
                : status === "fixed"
                  ? "Fixed"
                  : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {data === undefined ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-10 text-center text-xs text-muted-foreground">
            No feedback found.
          </div>
        ) : (
          <div>
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full text-left gap-3 border-b border-zinc-800/50 px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "bg-zinc-800 border-l-2 border-l-indigo-500"
                      : "hover:bg-zinc-900 border-l-2 border-l-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 pt-0.5">
                    {item.reporter ? (
                      <UserAvatar
                        user={item.reporter}
                        size="xs"
                        disableLink
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-zinc-700" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">
                        {item.reporter?.name ??
                          item.reporter?.username ??
                          "Unknown"}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: false,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-medium text-indigo-400 truncate">
                        {typeLabel[item.type]}
                      </span>
                      {item.status === "open" ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-3.5 leading-none border-zinc-600 text-zinc-300"
                        >
                          Open
                        </Badge>
                      ) : (
                        <Badge
                          variant="default"
                          className="text-[9px] px-1 py-0 h-3.5 leading-none bg-emerald-500/20 text-emerald-300 border-0"
                        >
                          Fixed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                      {item.title ?? item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
