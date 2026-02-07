"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Megaphone, X } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface AnnouncementBannerProps {
  challengeId: string;
}

export function AnnouncementBanner({ challengeId }: AnnouncementBannerProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  const participation = useQuery(api.queries.participations.getCurrentUserParticipation, {
    challengeId: challengeId as Id<"challenges">,
  });

  const dismissAnnouncement = useMutation(api.mutations.challenges.dismissAnnouncement);

  // Don't show if no announcement
  if (!challenge?.announcement) {
    return null;
  }

  // Don't show if locally dismissed (optimistic UI)
  if (locallyDismissed) {
    return null;
  }

  // Don't show if already dismissed (and dismissal is after the announcement update)
  if (
    participation?.dismissedAnnouncementAt &&
    challenge.announcementUpdatedAt &&
    participation.dismissedAnnouncementAt >= challenge.announcementUpdatedAt
  ) {
    return null;
  }

  const handleDismiss = async () => {
    setIsDismissing(true);
    setLocallyDismissed(true); // Optimistic update
    try {
      await dismissAnnouncement({
        challengeId: challengeId as Id<"challenges">,
      });
    } catch (error) {
      // Revert on error
      setLocallyDismissed(false);
      console.error("Failed to dismiss announcement:", error);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4">
      <div className="relative rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <button
          onClick={handleDismiss}
          disabled={isDismissing}
          className="absolute right-2 top-2 rounded p-1 text-amber-400/60 transition-colors hover:bg-amber-500/20 hover:text-amber-400"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <Megaphone className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" />
          <div className="text-sm text-amber-200 prose prose-sm prose-amber prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-amber-300 prose-a:underline prose-strong:text-amber-100">
            <ReactMarkdown>{challenge.announcement}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
