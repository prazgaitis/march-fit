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
  initialLightweightMode?: boolean;
}

export function InstaFeed({
  challengeId,
  challengeStartDate,
  currentUser,
  initialItems = [],
  initialLightweightMode = false,
}: InstaFeedProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-0">
      <StoriesSection
        challengeId={challengeId}
        challengeStartDate={challengeStartDate}
        currentUser={currentUser}
      />

      <ActivityFeed
        challengeId={challengeId}
        currentUserId={currentUser?.id}
        initialItems={initialItems}
        initialLightweightMode={initialLightweightMode}
      />
    </div>
  );
}
