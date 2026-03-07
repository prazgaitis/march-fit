"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ActivityTypesList } from "./activity-types-list";
import { AvailabilityView } from "./availability-view";

interface Category {
  _id: string;
  name: string;
  sortOrder?: number;
}

interface ActivityTypesPageContentProps {
  challengeId: Id<"challenges">;
  activityTypes: Parameters<typeof ActivityTypesList>[0]["activityTypes"];
  categoryMap: Map<string, Category>;
  streakMinPoints: number;
}

type Tab = "reference" | "availability";

export function ActivityTypesPageContent({
  challengeId,
  activityTypes,
  categoryMap,
  streakMinPoints,
}: ActivityTypesPageContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("availability");

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-6 flex rounded-lg bg-zinc-900/50 p-1">
        <button
          onClick={() => setActiveTab("reference")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
            activeTab === "reference"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          Full Reference
        </button>
        <button
          onClick={() => setActiveTab("availability")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition relative",
            activeTab === "availability"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          For Me
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "reference" && (
        <ActivityTypesList
          activityTypes={activityTypes}
          categoryMap={categoryMap}
          streakMinPoints={streakMinPoints}
        />
      )}
      {activeTab === "availability" && (
        <AvailabilityView challengeId={challengeId} />
      )}
    </div>
  );
}
