"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LeaderboardList } from "./leaderboard-list";
import { WeeklyCategoryLeaderboard } from "./weekly-category-leaderboard";

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

type Tab = "overall" | "weekly";

export function LeaderboardTabs({
  entries,
  challengeId,
  currentUserId,
}: LeaderboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overall");

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-6 flex rounded-lg bg-zinc-900/50 p-1">
        <button
          onClick={() => setActiveTab("overall")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === "overall"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          Overall
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === "weekly"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          Weekly by Category
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "overall" ? (
        <LeaderboardList
          entries={entries}
          challengeId={challengeId}
          currentUserId={currentUserId}
        />
      ) : (
        <WeeklyCategoryLeaderboard
          challengeId={challengeId}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
