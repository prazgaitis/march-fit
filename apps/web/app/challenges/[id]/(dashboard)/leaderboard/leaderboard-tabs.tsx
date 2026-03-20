"use client";

import { useMemo, useCallback, useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeaderboardList } from "./leaderboard-list";
import { WeeklyCategoryLeaderboard } from "./weekly-category-leaderboard";
import { CumulativeCategoryLeaderboard } from "./cumulative-category-leaderboard";

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  totalPoints: number;
  currentStreak: number;
}

interface LeaderboardTabsProps {
  entries: LeaderboardEntry[];
  challengeId: string;
  currentUserId: string;
}

const TABS = ["overall", "cumulative", "weekly"] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

export function LeaderboardTabs({
  entries,
  challengeId,
  currentUserId,
}: LeaderboardTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const activeTab: Tab = isValidTab(tabParam) ? tabParam : "overall";
  const searchParam = searchParams.get("q") ?? "";

  const [isPending, startTransition] = useTransition();

  // Local search state for responsive typing; URL is updated as a low-priority transition
  const [search, setSearchLocal] = useState(searchParam);

  // Sync local state if URL param changes externally (e.g. back/forward nav)
  useEffect(() => {
    setSearchLocal(searchParam);
  }, [searchParam]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setActiveTab = useCallback(
    (tab: Tab) => updateParams({ tab: tab === "overall" ? null : tab }),
    [updateParams]
  );

  const setSearch = useCallback(
    (q: string) => {
      setSearchLocal(q);
      startTransition(() => {
        updateParams({ q: q || null });
      });
    },
    [updateParams]
  );

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.user.name?.toLowerCase().includes(q) ||
        e.user.username.toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-4 flex rounded-lg bg-zinc-900/50 p-1">
        <button
          onClick={() => setActiveTab("overall")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
            activeTab === "overall"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          Overall
        </button>
        <button
          onClick={() => setActiveTab("cumulative")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
            activeTab === "cumulative"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          Category
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
            activeTab === "weekly"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          Weekly
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pl-9 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "overall" && (
        <LeaderboardList
          entries={filteredEntries}
          challengeId={challengeId}
          currentUserId={currentUserId}
        />
      )}
      {activeTab === "cumulative" && (
        <CumulativeCategoryLeaderboard
          challengeId={challengeId}
          currentUserId={currentUserId}
          searchQuery={search}
        />
      )}
      {activeTab === "weekly" && (
        <WeeklyCategoryLeaderboard
          challengeId={challengeId}
          currentUserId={currentUserId}
          searchQuery={search}
        />
      )}
    </div>
  );
}
