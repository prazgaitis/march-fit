"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { formatTimeAgo } from "@/lib/date-only";
import {
  ArrowUp,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Repeat2,
  Share2,
} from "lucide-react";
import {
  useConvex,
  useConvexConnectionState,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ConvexError } from "convex/values";

import dynamic from "next/dynamic";
import { RichTextViewer } from "@/components/editor/rich-text-viewer";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then((mod) => ({
      default: mod.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[120px] w-full animate-pulse rounded-md border border-input bg-background" />
    ),
  },
);
import {
  useActivityNotification,
  useChallengeSummary,
} from "./challenge-realtime-context";
import { UserChallengeDisplay } from "@/components/user-challenge-display";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";
import {
  isEditorContentEmpty,
  type MentionableUser,
} from "@/lib/rich-text-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PointsDisplay } from "@/components/ui/points-display";
import { MediaGallery } from "@/components/media-gallery";
import { FollowButton } from "@/components/follow-button";
import { LikesDisplay } from "@/components/likes-display";
import { captureAppException, captureAppMessage } from "@/lib/sentry";
import { isLatestActivityVisibleInFeed } from "@/lib/feed-notification";
import { SuggestedFollows } from "./suggested-follows";
import { ActiveMiniGames } from "@/components/mini-games";

// ── Skeleton loader matching IG-style card layout ──────────────

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded bg-zinc-800 animate-pulse",
        className,
      )}
    />
  );
}

function FeedItemSkeleton({ showMedia = false }: { showMedia?: boolean }) {
  return (
    <div className="border-b border-zinc-800">
      {/* Header: avatar + name/username/time */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <SkeletonBar className="h-8 w-8 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-3.5 w-24" />
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-3 w-8" />
          </div>
          <SkeletonBar className="h-3 w-16" />
        </div>
      </div>
      {/* Notes (text-only card) or media placeholder */}
      {showMedia ? (
        <SkeletonBar className="mx-0 h-0 w-full rounded-none pb-[100%]" />
      ) : (
        <div className="space-y-1.5 px-4 pb-2">
          <SkeletonBar className="h-3.5 w-full" />
          <SkeletonBar className="h-3.5 w-3/4" />
        </div>
      )}
      {/* Stats row */}
      <div className="flex items-center gap-3 px-4 pt-2">
        <SkeletonBar className="h-3.5 w-14" />
        <SkeletonBar className="h-3.5 w-10" />
      </div>
      {/* Action bar */}
      <div className="flex items-center gap-5 px-4 py-2.5">
        <SkeletonBar className="h-4 w-4 rounded-full" />
        <SkeletonBar className="h-4 w-4 rounded-full" />
        <SkeletonBar className="h-4 w-4 rounded-full" />
        <SkeletonBar className="h-4 w-4 rounded-full" />
      </div>
      {/* Caption line (for media cards) */}
      {showMedia && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <SkeletonBar className="h-3.5 w-20" />
          <SkeletonBar className="h-3.5 w-40" />
        </div>
      )}
    </div>
  );
}

interface BonusThreshold {
  metric: string;
  threshold: number;
  bonusPoints: number;
  description: string;
}

export interface ActivityFeedItem {
  activity: {
    _id: string;
    id?: string; // mapped from _id for compatibility if needed
    notes: string | null;
    pointsEarned: number;
    loggedDate: number; // Convex returns number
    createdAt: number; // Convex returns number
    metrics?: Record<string, unknown>;
    triggeredBonuses?: BonusThreshold[];
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
  reposts: number;
  likedByUser: boolean;
  repostedByUser: boolean;
  mediaUrls: string[];
  cloudinaryPublicIds?: string[];
  recentLikers: Array<{ id: string; name: string | null; username: string }>;
}

interface ActivityFeedProps {
  challengeId: string;
  currentUserId?: string;
  initialItems?: ActivityFeedItem[];
  initialLightweightMode?: boolean;
}

type FeedFilter = "for_you" | "all" | "following";

interface FeedPageResponse {
  page: ActivityFeedItem[];
  continueCursor: string;
  isDone: boolean;
}

const ALGO_PAGE_SIZE = 10;

export function ActivityFeed({
  challengeId,
  currentUserId,
  initialItems = [],
  initialLightweightMode = false,
}: ActivityFeedProps) {
  const connectionState = useConvexConnectionState();
  const { summary } = useChallengeSummary();
  const { hasNewActivity, acknowledgeActivity } = useActivityNotification();
  const { users: mentionUsers } = useMentionableUsers(challengeId);
  const followingIds = useQuery(api.queries.follows.getFollowingIds);
  const followingSet = useMemo(() => new Set<string>((followingIds ?? []) as string[]), [followingIds]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("for_you");
  const [hasLoadedFollowingFeed, setHasLoadedFollowingFeed] = useState(false);
  const [useHttpFallback, setUseHttpFallback] = useState(false);
  const [httpItems, setHttpItems] = useState<ActivityFeedItem[]>(initialItems);
  const [httpCursor, setHttpCursor] = useState<string | null>(null);
  const [httpIsDone, setHttpIsDone] = useState(false);
  const [httpLoading, setHttpLoading] = useState(false);
  const httpRequestIdRef = useRef(0);
  const isMobileClient = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(
      navigator.userAgent,
    );
  }, []);
  const lightweightFeedMode = initialLightweightMode;

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.queries.activities.getChallengeFeed,
    feedFilter === "for_you"
      ? "skip"
      : {
          challengeId: challengeId as Id<"challenges">,
          followingOnly: feedFilter === "following",
          includeEngagementCounts: !lightweightFeedMode,
          includeMediaUrls: true,
        },
    { initialNumItems: 10 },
  );

  // For You: one-shot fetch of ranked entries (not reactive) so that
  // likes/comments/reposts don't re-sort the feed while the user is scrolling.
  // Each card subscribes to its own data reactively via getById.
  const convexClient = useConvex();
  type FeedEntry = { id: Id<"activities">; repostedBy?: string };
  const [rankedEntries, setRankedEntries] = useState<FeedEntry[] | undefined>(undefined);
  const algoFetchIdRef = useRef(0);
  useEffect(() => {
    if (feedFilter !== "for_you") {
      setRankedEntries(undefined);
      return;
    }
    const fetchId = ++algoFetchIdRef.current;
    convexClient
      .query(api.queries.algorithmicFeed.getRankedActivityIds, {
        challengeId: challengeId as Id<"challenges">,
      })
      .then((raw) => {
        if (fetchId !== algoFetchIdRef.current) return; // stale
        const entries = (raw as Array<Id<"activities"> | { id: Id<"activities">; repostedBy: string }>).map(
          (entry): FeedEntry =>
            typeof entry === "string"
              ? { id: entry }
              : { id: entry.id as Id<"activities">, repostedBy: entry.repostedBy },
        );
        setRankedEntries(entries);
      });
  }, [feedFilter, challengeId, convexClient]);

  const [algoVisibleCount, setAlgoVisibleCount] = useState(ALGO_PAGE_SIZE);

  const visibleAlgoEntries = useMemo(
    () => (rankedEntries ?? []).slice(0, algoVisibleCount),
    [rankedEntries, algoVisibleCount],
  );

  // Compat: bare ID list for injection slot calculations, load-more, etc.
  const visibleAlgoIds = useMemo(
    () => visibleAlgoEntries.map((e) => e.id),
    [visibleAlgoEntries],
  );

  // Compute stable random injection positions for mobile feed widgets.
  // Seeded by today's date so positions stay consistent within a session
  // but vary day-to-day. The two widgets are never adjacent.
  const injectionSlots = useMemo(() => {
    if (!isMobileClient || visibleAlgoIds.length < 5) return null;
    // Simple seed from date string
    const seed = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const rand = (n: number) => ((Math.abs(hash = ((hash << 13) ^ hash) - (hash >>> 7)) % n));

    // First widget: position 4–7 (after 5th–8th card)
    const pos1 = 4 + rand(4);
    // Second widget: at least 3 cards after the first, up to pos1+6
    const minPos2 = pos1 + 3;
    const maxPos2 = Math.min(pos1 + 6, visibleAlgoIds.length - 1);
    const pos2 = minPos2 <= maxPos2 ? minPos2 + rand(maxPos2 - minPos2 + 1) : minPos2;

    // Randomize which widget goes first
    const swapped = rand(2) === 0;
    return {
      miniGamesAt: swapped ? pos2 : pos1,
      suggestedAt: swapped ? pos1 : pos2,
    };
  }, [isMobileClient, visibleAlgoIds.length]);
  const algoCanLoadMore = (rankedEntries?.length ?? 0) > algoVisibleCount;
  const algoIsLoading = feedFilter === "for_you" && rankedEntries === undefined;

  const loadHttpPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      const requestId = ++httpRequestIdRef.current;
      setHttpLoading(true);

      try {
        const response = await fetch(`/api/challenges/${challengeId}/feed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            followingOnly: feedFilter === "following",
            includeEngagementCounts: !lightweightFeedMode,
            includeMediaUrls: true,
            cursor,
            numItems: 10,
          }),
        });

        if (!response.ok) {
          throw new Error(`Feed request failed with status ${response.status}`);
        }

        const data = (await response.json()) as FeedPageResponse;
        if (requestId !== httpRequestIdRef.current) {
          return;
        }

        setHttpItems((prev) => (append ? [...prev, ...data.page] : data.page));
        setHttpIsDone(data.isDone);
        setHttpCursor(data.isDone ? null : (data.continueCursor ?? null));
      } catch (error) {
        if (requestId !== httpRequestIdRef.current) {
          return;
        }
        console.error("Failed to load feed over HTTP fallback", error);
        captureAppException(error, {
          area: "activity-feed",
          challengeId,
          tags: {
            transport: "http-fallback",
            feedFilter,
            platform: isMobileClient ? "mobile" : "desktop",
          },
          extra: {
            lightweightFeedMode,
          },
        });
      } finally {
        if (requestId === httpRequestIdRef.current) {
          setHttpLoading(false);
        }
      }
    },
    [challengeId, feedFilter, isMobileClient, lightweightFeedMode],
  );

  useEffect(() => {
    if (useHttpFallback) {
      return;
    }
    if (!isLoading) {
      return;
    }
    if (
      connectionState.isWebSocketConnected ||
      connectionState.hasEverConnected
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      captureAppMessage(
        "Convex websocket not ready; enabling HTTP feed fallback",
        {
          area: "activity-feed",
          level: "warning",
          challengeId,
          tags: {
            feedFilter,
            platform: isMobileClient ? "mobile" : "desktop",
          },
          extra: {
            hasEverConnected: connectionState.hasEverConnected,
            isWebSocketConnected: connectionState.isWebSocketConnected,
            connectionRetries: connectionState.connectionRetries,
          },
        },
      );
      setUseHttpFallback(true);
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    challengeId,
    connectionState.connectionRetries,
    connectionState.hasEverConnected,
    connectionState.isWebSocketConnected,
    feedFilter,
    isMobileClient,
    isLoading,
    useHttpFallback,
  ]);

  useEffect(() => {
    if (!useHttpFallback) {
      return;
    }

    httpRequestIdRef.current += 1;
    setHttpCursor(null);
    setHttpIsDone(false);
    setHttpItems(feedFilter === "all" ? initialItems : []);

    void loadHttpPage(null, false);
  }, [feedFilter, initialItems, loadHttpPage, useHttpFallback]);

  const handleLoadMore = () => {
    if (feedFilter === "for_you") {
      setAlgoVisibleCount((prev) => prev + ALGO_PAGE_SIZE);
      return;
    }

    if (useHttpFallback) {
      if (!httpLoading && !httpIsDone && httpCursor) {
        void loadHttpPage(httpCursor, true);
      }
      return;
    }

    if (status === "CanLoadMore") {
      loadMore(10);
    }
  };

  const handleRefresh = () => {
    acknowledgeActivity();
    // usePaginatedQuery updates automatically, but user might want to scroll to top or seeing "New Activity" alert.
    // effectively this just hides the alert.
  };

  const liveDisplayResults = useMemo(() => {
    if (feedFilter === "for_you") {
      return []; // For You tab renders via ReactiveActivityCard, not displayResults
    }

    if (feedFilter !== "all") {
      return results;
    }

    if (results === undefined || results.length === 0) {
      return initialItems;
    }

    return results;
  }, [feedFilter, initialItems, results]);

  const displayResults = useMemo(() => {
    if (!useHttpFallback) {
      return liveDisplayResults;
    }

    if (feedFilter === "all" && httpItems.length === 0) {
      return initialItems;
    }

    return httpItems;
  }, [
    feedFilter,
    httpItems,
    initialItems,
    liveDisplayResults,
    useHttpFallback,
  ]);

  const latestActivityVisible = useMemo(
    () =>
      isLatestActivityVisibleInFeed(displayResults, summary.latestActivityId),
    [displayResults, summary.latestActivityId],
  );

  useEffect(() => {
    if (!hasNewActivity || !latestActivityVisible) {
      return;
    }

    acknowledgeActivity();
  }, [acknowledgeActivity, hasNewActivity, latestActivityVisible]);

  const showRefreshPrompt =
    feedFilter === "all" && hasNewActivity && !latestActivityVisible;

  const showForYouNewBanner =
    feedFilter === "for_you" && hasNewActivity;

  const effectiveIsLoading =
    feedFilter === "for_you"
      ? algoIsLoading
      : useHttpFallback
        ? httpLoading
        : isLoading;
  const canLoadMore =
    feedFilter === "for_you"
      ? algoCanLoadMore
      : useHttpFallback
        ? !httpIsDone && !httpLoading && httpCursor !== null
        : status === "CanLoadMore";

  useEffect(() => {
    if (feedFilter === "following" && !effectiveIsLoading) {
      setHasLoadedFollowingFeed(true);
    }
  }, [effectiveIsLoading, feedFilter]);

  const showFollowingInitialLoadingHint =
    feedFilter === "following" &&
    !hasLoadedFollowingFeed &&
    effectiveIsLoading &&
    (displayResults?.length ?? 0) === 0;

  const showFeedSkeleton = useMemo(() => {
    const hasInitialFeed =
      (feedFilter === "all" && (displayResults?.length ?? 0) > 0) ||
      (feedFilter === "for_you" && visibleAlgoIds.length > 0);
    return effectiveIsLoading && !hasInitialFeed;
  }, [displayResults, effectiveIsLoading, feedFilter, visibleAlgoIds.length]);

  return (
    <div>
      {/* Twitter-like Feed Filter Tabs */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 border-b border-zinc-800 bg-black/80 backdrop-blur">
        <div className="flex">
          <button
            onClick={() => setFeedFilter("for_you")}
            className={cn(
              "relative min-h-[44px] flex-1 py-4 text-center text-sm font-medium transition-colors hover:bg-zinc-900/50 active:bg-zinc-800/50",
              feedFilter === "for_you" ? "text-white" : "text-zinc-500",
            )}
          >
            For You
            {feedFilter === "for_you" && (
              <div className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-indigo-500" />
            )}
          </button>
          <button
            onClick={() => setFeedFilter("all")}
            className={cn(
              "relative min-h-[44px] flex-1 py-4 text-center text-sm font-medium transition-colors hover:bg-zinc-900/50 active:bg-zinc-800/50",
              feedFilter === "all" ? "text-white" : "text-zinc-500",
            )}
          >
            All
            {feedFilter === "all" && (
              <div className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-indigo-500" />
            )}
          </button>
          <button
            onClick={() => setFeedFilter("following")}
            className={cn(
              "relative min-h-[44px] flex-1 py-4 text-center text-sm font-medium transition-colors hover:bg-zinc-900/50 active:bg-zinc-800/50",
              feedFilter === "following" ? "text-white" : "text-zinc-500",
            )}
          >
            Following
            {feedFilter === "following" && (
              <div className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-indigo-500" />
            )}
          </button>
        </div>
      </div>

      {showForYouNewBanner && (
        <div className="fixed left-1/2 top-20 z-20 -translate-x-1/2">
          <button
            onClick={() => {
              acknowledgeActivity();
              setFeedFilter("all");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUp className="h-4 w-4" />
            New activities
          </button>
        </div>
      )}

      {showRefreshPrompt && (
        <Alert className="border-primary/30 bg-primary/10">
          <AlertTitle className="font-semibold">New activity!</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>
              Fresh activities have been logged since your last refresh.
            </span>
            <Button size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh feed
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showFeedSkeleton && (
        <div className="space-y-0">
          {[0, 1, 2].map((i) => (
            <FeedItemSkeleton key={i} showMedia={i === 0} />
          ))}
        </div>
      )}

      {showFollowingInitialLoadingHint && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
          Gathering activities from people you follow...
        </div>
      )}

      <div className="h-2" />

      {/* For You tab: each card subscribes reactively to its own data */}
      {feedFilter === "for_you" &&
        visibleAlgoEntries.map((entry, index) => (
          <div key={entry.repostedBy ? `${entry.id}-repost-${entry.repostedBy}` : entry.id}>
            {entry.repostedBy && (
              <div className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-xs text-zinc-500">
                <Repeat2 className="h-3.5 w-3.5" />
                <span>
                  <span className="font-medium text-zinc-400">@{entry.repostedBy}</span> reposted
                </span>
              </div>
            )}
            <ReactiveActivityCard
              activityId={entry.id}
              challengeId={challengeId}
              showEngagementCounts={!lightweightFeedMode}
              mentionOptions={mentionUsers}
              currentUserId={currentUserId}
              followingSet={followingSet}
            />
            {injectionSlots?.miniGamesAt === index && (
              <div className="py-3">
                <ActiveMiniGames challengeId={challengeId} userId={currentUserId ?? ""} variant="feed" />
              </div>
            )}
            {injectionSlots?.suggestedAt === index && (
              <div className="py-3">
                <SuggestedFollows challengeId={challengeId} variant="feed" />
              </div>
            )}
          </div>
        ))}

      {/* All / Following tabs: render from paginated query results */}
      {feedFilter !== "for_you" &&
        displayResults
          ?.filter(
            (
              item,
            ): item is NonNullable<typeof item> & {
              user: NonNullable<(typeof item)["user"]>;
            } => item.user !== null,
          )
          .map((item) => (
            <ActivityCard
              key={item.activity._id}
              challengeId={challengeId}
              showEngagementCounts={!lightweightFeedMode}
              item={{
                ...item,
                activity: {
                  ...item.activity,
                  id: item.activity._id,
                },
                reposts: ("reposts" in item ? (item as any).reposts : 0) ?? 0,
                repostedByUser: ("repostedByUser" in item ? (item as any).repostedByUser : false) ?? false,
                mediaUrls: item.mediaUrls ?? [],
              }}
              mentionOptions={mentionUsers}
              currentUserId={currentUserId}
              isFollowing={followingSet.has(item.user.id)}
            />
          ))}

      {!effectiveIsLoading && feedFilter === "for_you" && visibleAlgoIds.length === 0 && rankedEntries !== undefined && (
        <Card className="border-dashed text-center">
          <CardHeader>
            <CardTitle>No activity yet</CardTitle>
            <CardDescription>
              Activities will appear here once people start logging workouts.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!effectiveIsLoading && feedFilter !== "for_you" && (displayResults?.length ?? 0) === 0 && (
        <Card className="border-dashed text-center">
          <CardHeader>
            <CardTitle>
              {feedFilter === "following"
                ? "No activity from people you follow"
                : "No activity yet"}
            </CardTitle>
            <CardDescription>
              {feedFilter === "following"
                ? "Follow other participants to see their activities here."
                : "Be the first to log a workout for this challenge."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={effectiveIsLoading}
          >
            {effectiveIsLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper to format metric values with units
function formatMetricValue(
  metrics: Record<string, unknown> | undefined,
  scoringConfig: Record<string, unknown> | undefined,
): string | null {
  if (!metrics || !scoringConfig) return null;

  const unit = scoringConfig.unit as string | undefined;
  if (!unit) return null;

  const value = metrics[unit];
  if (value === undefined || value === null) return null;

  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return null;

  // Format based on unit type
  const unitLabels: Record<string, string> = {
    miles: "mi",
    kilometers: "km",
    km: "km",
    minutes: "min",
    hours: "hr",
    drinks: "drinks",
    completion: "",
    completions: "",
  };

  const label = unitLabels[unit] || unit;
  const formatted =
    numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);

  return label ? `${formatted} ${label}` : formatted;
}

function ActivityStats({ item }: { item: ActivityFeedItem }) {
  const metricDisplay = formatMetricValue(
    item.activity.metrics,
    item.activityType?.scoringConfig,
  );

  const hasBonuses =
    item.activity.triggeredBonuses && item.activity.triggeredBonuses.length > 0;
  const bonusTotal = hasBonuses
    ? item.activity.triggeredBonuses!.reduce((sum, b) => sum + b.bonusPoints, 0)
    : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      {metricDisplay && (
        <span className="font-mono font-semibold text-foreground">
          {metricDisplay}
        </span>
      )}
      {metricDisplay && <span className="text-zinc-600">/</span>}
      <PointsDisplay
        points={item.activity.pointsEarned}
        isNegative={item.activityType?.isNegative}
        decimals={2}
        size="sm"
        showSign={false}
        hasBonuses={!!hasBonuses}
        className="font-mono font-medium"
      />
      {hasBonuses &&
        item.activity.triggeredBonuses!.map((bonus, i) => (
          <span key={i} className="text-xs text-amber-500">
            +{bonus.bonusPoints} {bonus.description.replace(/ bonus$/i, "").toLowerCase()}
          </span>
        ))}
    </div>
  );
}

/**
 * Wrapper that subscribes to a single activity by ID via useQuery.
 * Each card is independently reactive — likes, comments, etc. update instantly.
 */
const ReactiveActivityCard = memo(function ReactiveActivityCard({
  activityId,
  challengeId,
  showEngagementCounts,
  mentionOptions,
  currentUserId,
  followingSet,
}: {
  activityId: Id<"activities">;
  challengeId: string;
  showEngagementCounts: boolean;
  mentionOptions: MentionableUser[];
  currentUserId?: string;
  followingSet: Set<string>;
}) {
  const data = useQuery(api.queries.activities.getById, { activityId });

  if (!data) return null;

  const item: ActivityFeedItem = {
    activity: {
      _id: data.activity._id as string,
      id: data.activity._id as string,
      notes: data.activity.notes ?? null,
      pointsEarned: data.activity.pointsEarned,
      loggedDate: data.activity.loggedDate,
      createdAt: data.activity.createdAt,
      metrics: data.activity.metrics as Record<string, unknown> | undefined,
      triggeredBonuses: data.activity.triggeredBonuses as BonusThreshold[] | undefined,
    },
    user: {
      id: data.user.id as string,
      name: data.user.name ?? null,
      username: data.user.username,
      avatarUrl: data.user.avatarUrl ?? null,
      location: data.user.location ?? null,
    },
    activityType: data.activityType
      ? {
          id: data.activityType.id as string,
          name: data.activityType.name,
          categoryId: data.activityType.categoryId as string | null,
          scoringConfig: data.activityType.scoringConfig as Record<string, unknown> | undefined,
          isNegative: data.activityType.isNegative,
        }
      : null,
    likes: data.likes,
    comments: data.comments,
    reposts: data.reposts ?? 0,
    likedByUser: data.likedByUser,
    repostedByUser: data.repostedByUser ?? false,
    mediaUrls: data.mediaUrls,
    cloudinaryPublicIds: data.cloudinaryPublicIds,
    recentLikers: data.recentLikers,
  };

  return (
    <ActivityCard
      challengeId={challengeId}
      showEngagementCounts={showEngagementCounts}
      item={item}
      mentionOptions={mentionOptions}
      currentUserId={currentUserId}
      isFollowing={followingSet.has(data.user.id as string)}
    />
  );
});

interface ActivityCardProps {
  challengeId: string;
  item: ActivityFeedItem;
  showEngagementCounts: boolean;
  mentionOptions: MentionableUser[];
  currentUserId?: string;
  isFollowing: boolean;
  onLikeToggle?: (activityId: string, liked: boolean) => void;
}

export const ActivityCard = memo(function ActivityCard({
  challengeId,
  item,
  showEngagementCounts,
  mentionOptions,
  currentUserId,
  isFollowing,
}: ActivityCardProps) {
  const activityId = item.activity.id ?? item.activity._id;
  const router = useRouter();
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagCategory, setFlagCategory] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);

  const toggleLike = useMutation(api.mutations.likes.toggle);
  const toggleRepost = useMutation(api.mutations.reposts.toggle);
  const flagActivity = useMutation(api.mutations.activities.flagActivity);

  const handleToggleLike = useCallback(async () => {
    setIsLiking(true);
    try {
      await toggleLike({ activityId: activityId as Id<"activities"> });
    } catch (error) {
      console.error("Failed to toggle like", error);
    } finally {
      setIsLiking(false);
    }
  }, [activityId, toggleLike]);

  const handleToggleRepost = useCallback(async () => {
    setIsReposting(true);
    try {
      await toggleRepost({ activityId: activityId as Id<"activities"> });
    } catch (error) {
      console.error("Failed to toggle repost", error);
    } finally {
      setIsReposting(false);
    }
  }, [activityId, toggleRepost]);

  const activityUrl = `/challenges/${challengeId}/activities/${activityId}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest('[role="button"]') ||
      target.closest("textarea") ||
      target.closest("input")
    ) {
      return;
    }
    router.push(activityUrl);
  };

  const handleFlagSubmit = async () => {
    if (!flagCategory) return;
    if (flagCategory === "other" && !flagReason.trim()) return;
    setFlagSubmitting(true);
    setFlagError(null);
    const categoryLabel =
      flagCategory === "incorrect_type"
        ? "Logged as incorrect type"
        : flagCategory === "impossible"
          ? "Seems like an impossible feat of athleticism"
          : "";
    const reason =
      flagCategory === "other"
        ? flagReason.trim()
        : flagReason.trim()
          ? `${categoryLabel}: ${flagReason.trim()}`
          : categoryLabel;
    try {
      await flagActivity({
        activityId: activityId as Id<"activities">,
        reason,
      });
      setFlagSuccess(true);
      setFlagReason("");
    } catch (err) {
      setFlagError(
        err instanceof ConvexError
          ? (err.data as string)
          : err instanceof Error
            ? err.message
            : "Failed to report activity",
      );
    } finally {
      setFlagSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${activityUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Check out this activity",
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const actionBar = (
    <div
      className="flex items-center gap-6 sm:gap-4 text-muted-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        disabled={isLiking}
        onClick={handleToggleLike}
        className={cn(
          "flex items-center gap-1.5 text-sm transition-colors py-2",
          item.likedByUser
            ? "text-red-500"
            : "hover:text-red-500",
        )}
      >
        <Heart
          className={cn(
            "h-5 w-5 sm:h-[18px] sm:w-[18px]",
            item.likedByUser && "fill-current",
          )}
        />
        {showEngagementCounts && item.likes > 0 && (
          <span>{item.likes}</span>
        )}
      </button>
      <button
        onClick={() => setShowComments((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 text-sm transition-colors py-2",
          showComments ? "text-foreground" : "hover:text-foreground",
        )}
      >
        <MessageCircle className="h-5 w-5 sm:h-[18px] sm:w-[18px]" />
        {showEngagementCounts && item.comments > 0 && (
          <span>{item.comments}</span>
        )}
      </button>
      <button
        disabled={isReposting}
        onClick={handleToggleRepost}
        className={cn(
          "flex items-center gap-1.5 text-sm transition-colors py-2",
          item.repostedByUser
            ? "text-emerald-500"
            : "hover:text-emerald-500",
        )}
      >
        <Repeat2
          className="h-5 w-5 sm:h-[18px] sm:w-[18px]"
        />
        {showEngagementCounts && item.reposts > 0 && (
          <span>{item.reposts}</span>
        )}
      </button>
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 text-sm transition-colors hover:text-foreground py-2"
      >
        <Share2 className="h-5 w-5 sm:h-[18px] sm:w-[18px]" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="ml-auto flex items-center transition-colors hover:text-foreground">
            <MoreHorizontal className="h-[18px] w-[18px]" />
            <span className="sr-only">More options</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setFlagSuccess(false);
              setFlagError(null);
              setFlagCategory("");
              setFlagReason("");
              setShowFlagDialog(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Flag className="mr-2 h-4 w-4" />
            Report activity
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Activity</DialogTitle>
            <DialogDescription>
              Flag this activity for admin review. Please describe why you
              think this activity should be reviewed.
            </DialogDescription>
          </DialogHeader>
          {flagSuccess ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Thank you for your report. An admin will review this activity.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <RadioGroup
                value={flagCategory}
                onValueChange={setFlagCategory}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="incorrect_type"
                    id="feed-flag-incorrect"
                  />
                  <Label htmlFor="feed-flag-incorrect">
                    Logged as incorrect type
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="impossible"
                    id="feed-flag-impossible"
                  />
                  <Label htmlFor="feed-flag-impossible">
                    Seems like an impossible feat of athleticism
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="feed-flag-other" />
                  <Label htmlFor="feed-flag-other">Other</Label>
                </div>
              </RadioGroup>
              <Textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Add additional context (optional)..."
                rows={3}
                maxLength={2000}
              />
              {flagError && (
                <p className="text-sm text-destructive">{flagError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            {flagSuccess ? (
              <Button
                variant="outline"
                onClick={() => setShowFlagDialog(false)}
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowFlagDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleFlagSubmit}
                  disabled={
                    flagSubmitting ||
                    !flagCategory ||
                    (flagCategory === "other" && !flagReason.trim())
                  }
                >
                  {flagSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting
                    </>
                  ) : (
                    "Submit Report"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const commentsSection = (
    <div onClick={(e) => e.stopPropagation()}>
      <InlineComments
        activityId={activityId}
        challengeId={challengeId}
        showCommentInput={showComments}
        mentionOptions={mentionOptions}
      />
    </div>
  );

  const isOwnPost = currentUserId === item.user.id;

  const headerContent = (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <UserChallengeDisplay
          user={item.user}
          challengeId={challengeId}
          size="sm"
          layout="inline"
          show={{ name: true, username: true }}
          suffix={
            <>
              <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTimeAgo(item.activity.createdAt)}
              </span>
            </>
          }
        >
          <span className="text-xs text-muted-foreground">
            {item.activityType?.name ?? "Activity"}
          </span>
        </UserChallengeDisplay>
      </div>
      {!isOwnPost && (
        <FollowButton userId={item.user.id} isFollowing={isFollowing} />
      )}
    </div>
  );

  const hasMedia = item.mediaUrls.length > 0 || (item.cloudinaryPublicIds && item.cloudinaryPublicIds.length > 0);

  const bodyContent = item.activity.notes ? (
    hasMedia ? (
      <div className="text-sm leading-snug">
        <span className="font-semibold text-foreground">
          {item.user.username}
        </span>{" "}
        <RichTextViewer
          content={item.activity.notes}
          className="inline text-sm text-muted-foreground [&_p]:inline"
        />
      </div>
    ) : (
      <RichTextViewer
        content={item.activity.notes}
        className="text-sm text-muted-foreground"
      />
    )
  ) : null;

  const mediaContent = hasMedia ? (
    <MediaGallery
      urls={item.mediaUrls}
      optimizedMediaIds={item.cloudinaryPublicIds}
      variant="feed"
    />
  ) : null;

  const likesDisplay = showEngagementCounts && item.likes > 0 ? (
    <div onClick={(e) => e.stopPropagation()}>
      <LikesDisplay
        activityId={activityId}
        challengeId={challengeId}
        likes={item.likes}
        likedByUser={item.likedByUser}
        recentLikers={item.recentLikers ?? []}
        currentUserId={currentUserId}
      />
    </div>
  ) : null;

  return (
    <article
      className="cursor-pointer transition-colors active:bg-zinc-900/50"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
      onClick={handleCardClick}
    >
      <div className="px-4 pt-3 pb-1" onClick={(e) => e.stopPropagation()}>{headerContent}</div>
      {!hasMedia && <div className="space-y-2 px-4">{bodyContent}</div>}
      {mediaContent && <div className="mt-2">{mediaContent}</div>}
      <div className="px-4 pt-1"><ActivityStats item={item} /></div>
      <div className="px-4 py-1">{actionBar}</div>
      {likesDisplay && <div className="px-4">{likesDisplay}</div>}
      {hasMedia && bodyContent && <div className="px-4">{bodyContent}</div>}
      <div className="px-4 pb-3">{commentsSection}</div>
      <div className="border-b border-zinc-800" />
    </article>
  );
});

function InlineComments({
  activityId,
  challengeId,
  showCommentInput,
  mentionOptions,
}: {
  activityId: string;
  challengeId: string;
  showCommentInput: boolean;
  mentionOptions: MentionableUser[];
}) {
  const [commentInput, setCommentInput] = useState("");
  const [commentIsEmpty, setCommentIsEmpty] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const {
    results: comments,
    status: commentsStatus,
    loadMore: loadMoreComments,
    isLoading: loadingComments,
  } = usePaginatedQuery(
    api.queries.comments.getByActivityId,
    { activityId: activityId as Id<"activities"> },
    { initialNumItems: 3 },
  );

  const createComment = useMutation(api.mutations.comments.create);

  const handleSubmitComment = async () => {
    if (!commentInput || commentIsEmpty || isEditorContentEmpty(commentInput))
      return;

    try {
      setSubmittingComment(true);
      setCommentError(null);

      await createComment({
        activityId: activityId as Id<"activities">,
        content: commentInput,
      });

      setCommentInput("");
      setCommentIsEmpty(true);
    } catch (err) {
      console.error(err);
      setCommentError(
        err instanceof Error ? err.message : "Unable to post comment",
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const hasComments = comments && comments.length > 0;

  return (
    <div className="space-y-1.5">
      {/* Compact comment list — Instagram style */}
      {hasComments && (
        <div className="space-y-1">
          {comments.map(
            (entry: {
              comment: { id: string; createdAt: number; content: string };
              author: {
                id: string;
                name: string;
                username: string;
                avatarUrl: string | null;
              };
            }) => (
              <div key={entry.comment.id} className="text-sm leading-snug">
                <span className="font-semibold text-foreground">
                  {entry.author.username}
                </span>{" "}
                <RichTextViewer
                  content={entry.comment.content}
                  className="inline text-sm text-muted-foreground [&_p]:inline"
                />
              </div>
            ),
          )}

          {commentsStatus === "CanLoadMore" && !loadingComments && (
            <button
              className="text-xs text-muted-foreground"
              onClick={() => loadMoreComments(5)}
            >
              View more comments
            </button>
          )}

          {loadingComments && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          )}
        </div>
      )}

      {/* Comment input — shown when user taps comment button */}
      {showCommentInput && (
        <div className="space-y-2 pt-1">
          <RichTextEditor
            value={commentInput}
            onChange={setCommentInput}
            onIsEmptyChange={setCommentIsEmpty}
            placeholder="Add a comment..."
            disabled={submittingComment}
            mentionOptions={mentionOptions}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {commentError ? (
              <span className="text-destructive">{commentError}</span>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              disabled={
                submittingComment ||
                commentIsEmpty ||
                isEditorContentEmpty(commentInput)
              }
              onClick={handleSubmitComment}
            >
              {submittingComment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting
                </>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
