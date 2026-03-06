"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Loader2, ThumbsUp } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

interface RecentLiker {
  id: string;
  name: string | null;
  username: string;
}

interface LikesDisplayProps {
  activityId: string;
  challengeId: string;
  likes: number;
  likedByUser: boolean;
  recentLikers: RecentLiker[];
}

function formatLikersSummary(
  likes: number,
  likedByUser: boolean,
  recentLikers: RecentLiker[],
): React.ReactNode {
  if (likes === 0) return null;

  // Build the names to display
  const names: string[] = [];

  if (likedByUser) {
    names.push("you");
  }

  for (const liker of recentLikers) {
    if (names.length >= 2) break;
    // If user already added "you", skip if this liker is the current user
    // (we can't reliably check, but recentLikers won't include "you" label)
    const displayName = liker.name ?? liker.username;
    if (!names.includes(displayName) && displayName !== "you") {
      names.push(displayName);
    }
  }

  // If we still have no names, use generic
  if (names.length === 0) {
    if (likes === 1) return <><span className="font-semibold">1 like</span></>;
    return <><span className="font-semibold">{likes} likes</span></>;
  }

  const remaining = likes - names.length;

  if (remaining <= 0) {
    // All likers are named
    if (names.length === 1) {
      return (
        <>
          Liked by <span className="font-semibold">{names[0]}</span>
        </>
      );
    }
    return (
      <>
        Liked by <span className="font-semibold">{names[0]}</span> and{" "}
        <span className="font-semibold">{names[1]}</span>
      </>
    );
  }

  if (names.length === 1) {
    return (
      <>
        Liked by <span className="font-semibold">{names[0]}</span> and{" "}
        <span className="font-semibold">
          {remaining} {remaining === 1 ? "other" : "others"}
        </span>
      </>
    );
  }

  return (
    <>
      Liked by <span className="font-semibold">{names[0]}</span>,{" "}
      <span className="font-semibold">{names[1]}</span> and{" "}
      <span className="font-semibold">
        {remaining} {remaining === 1 ? "other" : "others"}
      </span>
    </>
  );
}

export function LikesDisplay({
  activityId,
  challengeId,
  likes,
  likedByUser,
  recentLikers,
}: LikesDisplayProps) {
  const [showLikers, setShowLikers] = useState(false);

  if (likes === 0) return null;

  const summary = formatLikersSummary(likes, likedByUser, recentLikers);

  return (
    <>
      <button
        className="text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setShowLikers(true)}
      >
        {summary}
      </button>

      <ResponsiveDialog open={showLikers} onOpenChange={setShowLikers}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Likes</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {likes} {likes === 1 ? "person" : "people"} liked this activity
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <LikersList
              activityId={activityId}
              challengeId={challengeId}
            />
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

function LikersList({
  activityId,
  challengeId,
}: {
  activityId: string;
  challengeId: string;
}) {
  const likers = useQuery(api.queries.likes.getLikers, {
    activityId: activityId as Id<"activities">,
  });

  if (likers === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (likers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <ThumbsUp className="h-8 w-8" />
        <p className="text-sm">No likes yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-4">
      {likers.map((liker: { id: string; name: string | null; username: string; avatarUrl: string | null }) => (
        <div key={liker.id} className="py-2">
          <UserAvatar
            user={liker}
            challengeId={challengeId}
            size="sm"
            showName
            showUsername
          />
        </div>
      ))}
    </div>
  );
}
