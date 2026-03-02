"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
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

type Tab = "overall" | "cumulative" | "weekly";

export function LeaderboardTabs({
  entries,
  challengeId,
  currentUserId,
}: LeaderboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overall");
  const [search, setSearch] = useState("");

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
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex rounded-lg bg-zinc-900/50 p-1">
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
