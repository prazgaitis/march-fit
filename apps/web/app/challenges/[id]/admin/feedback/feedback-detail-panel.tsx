"use client";

import { MessageSquare } from "lucide-react";
import { useFeedbackList } from "./feedback-list-context";
import { FeedbackDetailContent } from "./feedback-detail-content";

interface FeedbackDetailPanelProps {
  challengeId: string;
}

export function FeedbackDetailPanel({ challengeId }: FeedbackDetailPanelProps) {
  const { selectedId } = useFeedbackList();

  if (!selectedId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <MessageSquare className="h-10 w-10 text-zinc-700 mb-3" />
        <p className="text-sm font-medium text-zinc-400">
          Select a feedback item to review
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Choose an item from the list to see its details and respond.
        </p>
      </div>
    );
  }

  return (
    <FeedbackDetailContent
      key={selectedId}
      challengeId={challengeId}
      feedbackId={selectedId}
    />
  );
}
