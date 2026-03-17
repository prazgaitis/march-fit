"use client";

import { useMemo } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

import {
  ActivityCard,
  type ActivityFeedItem,
} from "@/components/dashboard/activity-feed";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";

interface UserActivitiesContentProps {
  challengeId: string;
  profileUserId: string;
  currentUserId?: string;
}

export function UserActivitiesContent({
  challengeId,
  profileUserId,
  currentUserId,
}: UserActivitiesContentProps) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.queries.activities.getChallengeFeed,
    {
      challengeId: challengeId as Id<"challenges">,
      userId: profileUserId as Id<"users">,
      includeEngagementCounts: true,
      includeMediaUrls: true,
    },
    { initialNumItems: 10 },
  );

  const sentinelRef = useInfiniteScroll(() => loadMore(10), {
    enabled: status === "CanLoadMore" && !isLoading,
  });

  const followingIds = useQuery(api.queries.follows.getFollowingIds);
  const followingSet = useMemo(
    () => new Set(followingIds ?? []),
    [followingIds],
  );
  const { users: mentionUsers } = useMentionableUsers(challengeId);

  const items = (results ?? []).filter(
    (
      item,
    ): item is NonNullable<typeof item> & {
      user: NonNullable<(typeof item)["user"]>;
    } => item.user !== null,
  ) as ActivityFeedItem[];

  return (
    <div>
      {status === "LoadingFirstPage" && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status !== "LoadingFirstPage" && items.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No activities logged yet.
        </p>
      )}

      {items.map((item) => (
        <ActivityCard
          key={item.activity._id}
          challengeId={challengeId}
          showEngagementCounts
          item={{
            ...item,
            activity: {
              ...item.activity,
              id: item.activity._id,
            },
            mediaUrls: item.mediaUrls ?? [],
            cloudinaryPublicIds: item.cloudinaryPublicIds,
          }}
          mentionOptions={mentionUsers}
          currentUserId={currentUserId}
          isFollowing={followingSet.has(item.user.id)}
        />
      ))}

      {(status === "CanLoadMore" || isLoading) && status !== "LoadingFirstPage" && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
        </div>
      )}
    </div>
  );
}
