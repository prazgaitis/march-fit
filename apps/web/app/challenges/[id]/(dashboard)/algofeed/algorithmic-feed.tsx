"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ThumbsUp, MessageCircle, Zap } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { UserChallengeDisplay } from "@/components/user-challenge-display";
import { RichTextViewer } from "@/components/editor/rich-text-viewer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { PointsDisplay } from "@/components/ui/points-display";
import { MediaGallery } from "@/components/media-gallery";
import { cn } from "@/lib/utils";

interface AlgoFeedItem {
  activity: {
    _id: string;
    notes?: string;
    pointsEarned: number;
    createdAt: number;
    metrics?: Record<string, unknown>;
    triggeredBonuses?: Array<{
      metric: string;
      threshold: number;
      bonusPoints: number;
      description: string;
    }>;
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
    isNegative?: boolean;
  } | null;
  likes: number;
  comments: number;
  likedByUser: boolean;
  mediaUrls: string[];
  displayScore: number;
}

interface AlgorithmicFeedProps {
  challengeId: string;
}

export function AlgorithmicFeed({ challengeId }: AlgorithmicFeedProps) {
  const feedResult = useQuery(
    api.queries.algorithmicFeed.getAlgorithmicFeed,
    {
      challengeId: challengeId as Id<"challenges">,
      includeEngagementCounts: true,
      includeMediaUrls: true,
    },
  );

  if (feedResult === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading algorithmic feed...
      </div>
    );
  }

  const results = feedResult.page as AlgoFeedItem[];

  if (results.length === 0) {
    return (
      <Card className="border-dashed text-center">
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            No scored activities yet. Run the backfill to populate feed scores.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {results
        .filter((item) => item?.user != null)
        .map((item) => (
          <AlgoFeedCard
            key={item.activity._id}
            challengeId={challengeId}
            item={item}
          />
        ))}

    </div>
  );
}

function AlgoFeedCard({
  challengeId,
  item,
}: {
  challengeId: string;
  item: {
    activity: {
      _id: string;
      notes?: string;
      pointsEarned: number;
      createdAt: number;
      metrics?: Record<string, unknown>;
      triggeredBonuses?: Array<{
        metric: string;
        threshold: number;
        bonusPoints: number;
        description: string;
      }>;
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
      isNegative?: boolean;
    } | null;
    likes: number;
    comments: number;
    likedByUser: boolean;
    mediaUrls: string[];
    displayScore: number;
  };
}) {
  const router = useRouter();
  const toggleLike = useMutation(api.mutations.likes.toggle);

  const activityUrl = `/challenges/${challengeId}/activities/${item.activity._id}`;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    router.push(activityUrl);
  };

  const handleToggleLike = useCallback(async () => {
    try {
      await toggleLike({ activityId: item.activity._id as Id<"activities"> });
    } catch (error) {
      console.error("Failed to toggle like", error);
    }
  }, [item.activity._id, toggleLike]);

  const hasBonuses =
    item.activity.triggeredBonuses && item.activity.triggeredBonuses.length > 0;

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-colors hover:bg-muted/30"
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <UserChallengeDisplay
            user={item.user}
            challengeId={challengeId}
            size="sm"
            show={{ name: true, username: true, location: true }}
            suffix={
              <>
                <span aria-hidden="true">&middot;</span>
                <span className="text-sm">
                  {formatDistanceToNow(new Date(item.activity.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </>
            }
          />
          <span
            className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400"
            title="Feed score (debug)"
          >
            {item.displayScore.toFixed(1)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {item.activityType?.name ?? "Activity"}
          </p>
          {item.activity.notes ? (
            <RichTextViewer
              content={item.activity.notes}
              className="mt-2 text-sm text-muted-foreground"
            />
          ) : null}
        </div>

        {/* Media Gallery */}
        <MediaGallery urls={item.mediaUrls} variant="feed" />

        {/* Stats */}
        <div className="rounded-lg bg-muted px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <PointsDisplay
              points={item.activity.pointsEarned}
              isNegative={item.activityType?.isNegative}
              decimals={1}
              size="sm"
              showSign={false}
              hasBonuses={!!hasBonuses}
              className="font-medium"
            />
          </div>
          {hasBonuses && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.activity.triggeredBonuses!.map((bonus, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500"
                >
                  <Zap className="h-3 w-3" />
                  {bonus.description}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant={item.likedByUser ? "default" : "outline"}
          size="sm"
          onClick={handleToggleLike}
        >
          <ThumbsUp
            className={cn("mr-2 h-4 w-4", item.likedByUser && "fill-current")}
          />
          {item.likes}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(activityUrl)}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {item.comments}
        </Button>
      </CardFooter>
    </Card>
  );
}
