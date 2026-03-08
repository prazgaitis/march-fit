"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { StoriesSection } from "@/components/dashboard/stories-section";

interface InstaFeedProps {
  challengeId: string;
  challengeStartDate?: string;
  currentUser?: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  initialItems?: any[];
  initialAlgoItems?: any[];
  initialLightweightMode?: boolean;
}

export function InstaFeed({
  challengeId,
  challengeStartDate,
  currentUser,
  initialItems = [],
  initialAlgoItems = [],
  initialLightweightMode = false,
}: InstaFeedProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-0">
      <StoriesSection
        challengeId={challengeId}
        challengeStartDate={challengeStartDate}
        currentUser={currentUser}
        initialAlgoItems={initialAlgoItems}
      />

      <ActivityFeed
        challengeId={challengeId}
        currentUserId={currentUser?.id}
        initialItems={initialItems}
        initialAlgoItems={initialAlgoItems}
        initialLightweightMode={initialLightweightMode}
      />
    </div>
  );
}
