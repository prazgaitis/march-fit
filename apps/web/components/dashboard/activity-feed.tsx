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
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUp,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Zap,
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

interface BonusThreshold {
  metric: string;
  threshold: number;
  bonusPoints: number;
  description: string;
}

interface ActivityFeedItem {
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
  likedByUser: boolean;
  mediaUrls: string[];
  cloudinaryPublicIds?: string[];
  recentLikers: Array<{ id: string; name: string | null; username: string }>;
}

interface AlgoFeedItem {
  activity: {
    _id: string;
    notes: string | null;
    pointsEarned: number;
    loggedDate: number;
    createdAt: number;
    metrics?: Record<string, unknown>;
    triggeredBonuses?: BonusThreshold[];
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
  cloudinaryPublicIds?: string[];
  recentLikers: Array<{ id: string; name: string | null; username: string }>;
  displayScore: number;
}

function mapAlgoItem(item: AlgoFeedItem): ActivityFeedItem {
  return {
    activity: {
      _id: item.activity._id,
      notes: item.activity.notes,
      pointsEarned: item.activity.pointsEarned,
      loggedDate: item.activity.loggedDate,
      createdAt: item.activity.createdAt,
      metrics: item.activity.metrics,
      triggeredBonuses: item.activity.triggeredBonuses,
    },
    user: item.user,
    activityType: item.activityType,
    likes: item.likes,
    comments: item.comments,
    likedByUser: item.likedByUser,
    mediaUrls: item.mediaUrls,
    cloudinaryPublicIds: item.cloudinaryPublicIds,
    recentLikers: item.recentLikers ?? [],
  };
}

interface ActivityFeedProps {
  challengeId: string;
  currentUserId?: string;
  initialItems?: ActivityFeedItem[];
  initialAlgoItems?: AlgoFeedItem[];
  initialLightweightMode?: boolean;
}

type FeedFilter = "for_you" | "all" | "following";

interface FeedPageResponse {
  page: ActivityFeedItem[];
  continueCursor: string;
  isDone: boolean;
}

export function ActivityFeed({
  challengeId,
  currentUserId,
  initialItems = [],
  initialAlgoItems = [],
  initialLightweightMode = false,
}: ActivityFeedProps) {
  const connectionState = useConvexConnectionState();
  const { summary } = useChallengeSummary();
  const { hasNewActivity, acknowledgeActivity } = useActivityNotification();
  const { users: mentionUsers } = useMentionableUsers(challengeId);
  const followingIds = useQuery(api.queries.follows.getFollowingIds);
  const followingSet = useMemo(() => new Set(followingIds ?? []), [followingIds]);
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
  const lightweightFeedMode = initialLightweightMode || isMobileClient;

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

  // Snapshot-based algo feed: fetch once on mount/tab switch, re-fetch on explicit refresh only
  const convexClient = useConvex();
  const [algoSnapshot, setAlgoSnapshot] = useState<AlgoFeedItem[]>(
    () => (initialAlgoItems ?? []) as AlgoFeedItem[],
  );
  const [algoSnapshotLoading, setAlgoSnapshotLoading] = useState(false);
  const algoFetchIdRef = useRef(0);

  const fetchAlgoFeed = useCallback(async () => {
    const fetchId = ++algoFetchIdRef.current;
    setAlgoSnapshotLoading(true);
    try {
      const result = await convexClient.query(
        api.queries.algorithmicFeed.getAlgorithmicFeed,
        {
          challengeId: challengeId as Id<"challenges">,
          includeEngagementCounts: !lightweightFeedMode,
          includeMediaUrls: true,
        },
      );
      if (fetchId !== algoFetchIdRef.current) return;
      setAlgoSnapshot((result?.page ?? []) as AlgoFeedItem[]);
    } catch (error) {
      if (fetchId !== algoFetchIdRef.current) return;
      console.error("Failed to fetch algo feed", error);
    } finally {
      if (fetchId === algoFetchIdRef.current) {
        setAlgoSnapshotLoading(false);
      }
    }
  }, [convexClient, challengeId, lightweightFeedMode]);

  // Fetch algo feed when switching to "For You" tab
  useEffect(() => {
    if (feedFilter !== "for_you") return;
    // Only fetch if we don't have initial data
    if (algoSnapshot.length > 0 && algoFetchIdRef.current === 0) return;
    void fetchAlgoFeed();
  }, [feedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const algoResults = algoSnapshot;
  const algoIsLoading = algoSnapshotLoading && algoSnapshot.length === 0;

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

  const algoDisplayResults = useMemo((): ActivityFeedItem[] => {
    if (feedFilter !== "for_you") return [];
    return algoResults.map(mapAlgoItem);
  }, [algoResults, feedFilter]);


  const liveDisplayResults = useMemo(() => {
    if (feedFilter === "for_you") {
      return algoDisplayResults;
    }

    if (feedFilter !== "all") {
      return results;
    }

    if (results === undefined || results.length === 0) {
      return initialItems;
    }

    return results;
  }, [algoDisplayResults, feedFilter, initialItems, results]);

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
      ? false
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

  const feedStatus = useMemo(() => {
    const hasInitialFeed =
      (feedFilter === "all" || feedFilter === "for_you") &&
      (displayResults?.length ?? 0) > 0;
    if (effectiveIsLoading && !hasInitialFeed) {
      if (feedFilter === "following")
        return "Loading activity from people you follow...";
      if (feedFilter === "for_you") return "Loading your personalized feed...";
      return "Loading recent activities...";
    }
    return null;
  }, [displayResults, effectiveIsLoading, feedFilter]);

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
              void fetchAlgoFeed();
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

      {feedStatus && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {feedStatus}
        </div>
      )}

      {showFollowingInitialLoadingHint && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
          Gathering activities from people you follow...
        </div>
      )}

      <div className="h-2" />

      {displayResults
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
              mediaUrls: item.mediaUrls ?? [],
              cloudinaryPublicIds: item.cloudinaryPublicIds,
            }}
            mentionOptions={mentionUsers}
            currentUserId={currentUserId}
            isFollowing={followingSet.has(item.user.id)}
          />
        ))}

      {!effectiveIsLoading && (displayResults?.length ?? 0) === 0 && (
        <Card className="border-dashed text-center">
          <CardHeader>
            <CardTitle>
              {feedFilter === "following"
                ? "No activity from people you follow"
                : feedFilter === "for_you"
                  ? "No activity yet"
                  : "No activity yet"}
            </CardTitle>
            <CardDescription>
              {feedFilter === "following"
                ? "Follow other participants to see their activities here."
                : feedFilter === "for_you"
                  ? "Activities will appear here once people start logging workouts."
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
      {hasBonuses && (
        <span className="text-xs text-muted-foreground">
          (+{bonusTotal} bonus)
        </span>
      )}
      {hasBonuses && (
        <div className="flex flex-wrap gap-1.5">
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
  );
}

interface ActivityCardProps {
  challengeId: string;
  item: ActivityFeedItem;
  showEngagementCounts: boolean;
  mentionOptions: MentionableUser[];
  currentUserId?: string;
  isFollowing: boolean;
}

const ActivityCard = memo(function ActivityCard({
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
  const [showComments, setShowComments] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagCategory, setFlagCategory] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);

  const toggleLike = useMutation(api.mutations.likes.toggle);
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
      className="flex items-center gap-4 text-muted-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        disabled={isLiking}
        onClick={handleToggleLike}
        className={cn(
          "flex items-center gap-1.5 text-sm transition-colors",
          item.likedByUser
            ? "text-red-500"
            : "hover:text-red-500",
        )}
      >
        <Heart
          className={cn(
            "h-[18px] w-[18px]",
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
          "flex items-center gap-1.5 text-sm transition-colors",
          showComments ? "text-foreground" : "hover:text-foreground",
        )}
      >
        <MessageCircle className="h-[18px] w-[18px]" />
        {showEngagementCounts && item.comments > 0 && (
          <span>{item.comments}</span>
        )}
      </button>
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
      >
        <Share2 className="h-[18px] w-[18px]" />
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
          show={{ name: true, username: true, location: true }}
          suffix={
            <>
              <span aria-hidden="true">•</span>
              <span className="text-sm">
                {formatDistanceToNow(new Date(item.activity.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </>
          }
        >
          <span className="text-sm font-semibold text-primary">
            {item.activityType?.name ?? "Activity"}
          </span>
        </UserChallengeDisplay>
      </div>
      {!isOwnPost && (
        <FollowButton userId={item.user.id} isFollowing={isFollowing} />
      )}
    </div>
  );

  const bodyContent = (
    <>
      {item.activity.notes ? (
        <RichTextViewer
          content={item.activity.notes}
          className="text-sm text-muted-foreground"
        />
      ) : null}
      <MediaGallery urls={item.mediaUrls} cloudinaryPublicIds={item.cloudinaryPublicIds} variant="feed" />
      <ActivityStats item={item} />
    </>
  );

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
      <div className="space-y-2 px-4">{bodyContent}</div>
      {likesDisplay && <div className="px-4 pt-2">{likesDisplay}</div>}
      <div className="px-4 py-2">{actionBar}</div>
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
