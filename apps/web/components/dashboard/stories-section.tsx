"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { StoriesRow } from "./stories-row";
import { StoryViewer } from "./story-viewer";
import { buildStoriesFromFeed } from "@/lib/story-utils";
import { useCloudinaryDisplay } from "@/hooks/use-cloudinary-display";

const STORIES_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

interface StoriesSectionProps {
  challengeId: string;
  challengeStartDate?: string;
  currentUser?: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  initialAlgoItems?: any[];
}

export function StoriesSection({
  challengeId,
  challengeStartDate,
  currentUser,
  initialAlgoItems = [],
}: StoriesSectionProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const showCloudinary = useCloudinaryDisplay();

  const algoFeedResult = useQuery(
    api.queries.algorithmicFeed.getAlgorithmicFeed,
    {
      challengeId: challengeId as Id<"challenges">,
      includeEngagementCounts: true,
      includeMediaUrls: true,
      candidateLimit: 100,
    },
  );

  const stories = useMemo(
    () =>
      buildStoriesFromFeed(
        (algoFeedResult?.page ?? initialAlgoItems) as any[],
        challengeId,
        STORIES_MAX_AGE_MS,
        20,
        showCloudinary,
      ),
    [algoFeedResult, initialAlgoItems, challengeId, showCloudinary],
  );

  const handleStoryPress = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <StoriesRow
        stories={stories}
        onStoryPress={handleStoryPress}
        currentUser={currentUser}
        challengeId={challengeId}
        challengeStartDate={challengeStartDate}
      />
      {stories.length > 0 && (
        <div className="-mx-4 border-b border-zinc-800" />
      )}
      <StoryViewer
        stories={stories}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
