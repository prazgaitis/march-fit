"use client";

import { use } from "react";
import { FeedbackDetailContent } from "./feedback-detail-content";

interface FeedbackDetailPageProps {
  params: Promise<{ id: string; feedbackId: string }>;
}

export default function FeedbackDetailPage({
  params,
}: FeedbackDetailPageProps) {
  const { id: challengeId, feedbackId } = use(params);

  return (
    <FeedbackDetailContent
      challengeId={challengeId}
      feedbackId={feedbackId}
    />
  );
}
