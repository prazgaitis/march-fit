"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { StoriesRow, type StoryItem } from "@/components/dashboard/stories-row";
import { StoryViewer } from "@/components/dashboard/story-viewer";

interface AlgoFeedItem {
  activity: {
    _id: string;
    notes: string | null;
    pointsEarned: number;
    loggedDate: number;
    createdAt: number;
    metrics?: Record<string, unknown>;
    triggeredBonuses?: Array<{
      metric: string;
      threshold: number;
      bonusPoints: number;
      description: string;
    }>;
    _creationTime: number;
  };
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
    location?: string | null;
  };
  activityType: {
    id: string | null;
    name: string | null;
    categoryId: string | null;
    scoringConfig?: Record<string, unknown>;
    isNegative?: boolean;
  } | null;
  likes: number;
  comments: number;
  likedByUser: boolean;
  mediaUrls: string[];
  recentLikers: Array<{ id: string; name: string | null; username: string }>;
  displayScore: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFeedItem = any;

interface InstaFeedProps {
  challengeId: string;
  currentUserId?: string;
  initialItems?: AnyFeedItem[];
  initialAlgoItems?: AnyFeedItem[];
  initialLightweightMode?: boolean;
}

const STORIES_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

export function InstaFeed({
  challengeId,
  currentUserId,
  initialItems = [],
  initialAlgoItems = [],
  initialLightweightMode = false,
}: InstaFeedProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Fetch recent activities with media for stories
  const algoFeedResult = useQuery(
    api.queries.algorithmicFeed.getAlgorithmicFeed,
    {
      challengeId: challengeId as Id<"challenges">,
      includeEngagementCounts: false,
      includeMediaUrls: true,
      candidateLimit: 100,
    },
  );

  const stories = useMemo((): StoryItem[] => {
    const items = (algoFeedResult?.page ?? initialAlgoItems) as AlgoFeedItem[];
    const now = Date.now();

    // Deduplicate by user — show only the most recent activity per user
    const seenUsers = new Set<string>();

    return items
      .filter((item) => {
        if (!item.user || !item.mediaUrls || item.mediaUrls.length === 0)
          return false;
        if (now - item.activity.createdAt > STORIES_MAX_AGE_MS) return false;
        if (seenUsers.has(item.user.id)) return false;
        seenUsers.add(item.user.id);
        return true;
      })
      .sort((a, b) => b.activity.createdAt - a.activity.createdAt)
      .slice(0, 20)
      .map((item) => ({
        activityId: item.activity._id,
        user: {
          id: item.user.id,
          name: item.user.name,
          username: item.user.username,
          avatarUrl: item.user.avatarUrl,
        },
        mediaUrls: item.mediaUrls,
        activityType: item.activityType?.name ?? null,
        createdAt: item.activity.createdAt,
        pointsEarned: item.activity.pointsEarned,
      }));
  }, [algoFeedResult, initialAlgoItems]);

  const handleStoryPress = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-0">
      {/* Stories row */}
      <StoriesRow stories={stories} onStoryPress={handleStoryPress} />

      {stories.length > 0 && (
        <div className="border-b border-zinc-800" />
      )}

      {/* Regular feed below */}
      <ActivityFeed
        challengeId={challengeId}
        currentUserId={currentUserId}
        initialItems={initialItems}
        initialAlgoItems={initialAlgoItems}
        initialLightweightMode={initialLightweightMode}
      />

      {/* Story viewer overlay */}
      <StoryViewer
        stories={stories}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
