'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import * as Sentry from '@sentry/nextjs';
import {
  Flag,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Share2,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { useConvexConnectionState, useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { ConvexError } from 'convex/values';

import dynamic from 'next/dynamic';
import { RichTextViewer } from '@/components/editor/rich-text-viewer';

const RichTextEditor = dynamic(
  () => import('@/components/editor/rich-text-editor').then((mod) => ({ default: mod.RichTextEditor })),
  { ssr: false, loading: () => <div className="min-h-[120px] w-full animate-pulse rounded-md border border-input bg-background" /> }
);
import { useChallengeRealtime } from './challenge-realtime-context';
import { UserAvatar, UserAvatarInline } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMentionableUsers } from '@/hooks/use-mentionable-users';
import { isEditorContentEmpty, type MentionableUser } from '@/lib/rich-text-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PointsDisplay } from '@/components/ui/points-display';

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
}

interface ActivityFeedProps {
  challengeId: string;
  initialItems?: ActivityFeedItem[];
  initialLightweightMode?: boolean;
}

type FeedFilter = 'all' | 'following';

interface FeedPageResponse {
  page: ActivityFeedItem[];
  continueCursor: string;
  isDone: boolean;
}

export function ActivityFeed({
  challengeId,
  initialItems = [],
  initialLightweightMode = false,
}: ActivityFeedProps) {
  const connectionState = useConvexConnectionState();
  const { hasNewActivity, acknowledgeActivity } = useChallengeRealtime();
  const { users: mentionUsers } = useMentionableUsers(challengeId);
  const [pendingLikes, setPendingLikes] = useState<Record<string, boolean>>({});
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [useHttpFallback, setUseHttpFallback] = useState(false);
  const [httpItems, setHttpItems] = useState<ActivityFeedItem[]>(initialItems);
  const [httpCursor, setHttpCursor] = useState<string | null>(null);
  const [httpIsDone, setHttpIsDone] = useState(false);
  const [httpLoading, setHttpLoading] = useState(false);
  const httpRequestIdRef = useRef(0);
  const isMobileClient = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(
      navigator.userAgent,
    );
  }, []);
  const lightweightFeedMode = initialLightweightMode || isMobileClient;

  const {
    results,
    status,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.queries.activities.getChallengeFeed,
    {
      challengeId: challengeId as Id<"challenges">,
      followingOnly: feedFilter === 'following',
      includeEngagementCounts: !lightweightFeedMode,
      includeMediaUrls: !lightweightFeedMode,
    },
    { initialNumItems: 10 }
  );

  const loadHttpPage = useCallback(async (cursor: string | null, append: boolean) => {
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
          includeMediaUrls: !lightweightFeedMode,
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
      Sentry.captureException(error, {
        tags: {
          area: "activity-feed",
          transport: "http-fallback",
          feedFilter,
          platform: isMobileClient ? "mobile" : "desktop",
        },
        extra: {
          challengeId,
          lightweightFeedMode,
        },
      });
    } finally {
      if (requestId === httpRequestIdRef.current) {
        setHttpLoading(false);
      }
    }
  }, [challengeId, feedFilter, isMobileClient, lightweightFeedMode]);

  useEffect(() => {
    if (useHttpFallback) {
      return;
    }
    if (!isLoading) {
      return;
    }
    if (connectionState.isWebSocketConnected || connectionState.hasEverConnected) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      Sentry.captureMessage("Convex websocket not ready; enabling HTTP feed fallback", {
        level: "warning",
        tags: {
          area: "activity-feed",
          feedFilter,
          platform: isMobileClient ? "mobile" : "desktop",
        },
        extra: {
          challengeId,
          hasEverConnected: connectionState.hasEverConnected,
          isWebSocketConnected: connectionState.isWebSocketConnected,
          connectionRetries: connectionState.connectionRetries,
        },
      });
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

  const toggleLike = useMutation(api.mutations.likes.toggle);

  const handleToggleLike = async (activityId: string) => {
    setPendingLikes((prev) => ({ ...prev, [activityId]: true }));
    try {
        await toggleLike({ activityId: activityId as Id<"activities"> });
    } catch (error) {
        console.error("Failed to toggle like", error);
    } finally {
        setPendingLikes((prev) => {
            const next = { ...prev };
            delete next[activityId];
            return next;
        });
    }
  };

  const liveDisplayResults = useMemo(() => {
    if (feedFilter !== 'all') {
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
  }, [feedFilter, httpItems, initialItems, liveDisplayResults, useHttpFallback]);

  const effectiveIsLoading = useHttpFallback ? httpLoading : isLoading;
  const canLoadMore = useHttpFallback
    ? !httpIsDone && !httpLoading && httpCursor !== null
    : status === "CanLoadMore";

  const feedStatus = useMemo(() => {
    const hasInitialFeed = feedFilter === "all" && (displayResults?.length ?? 0) > 0;
    if (effectiveIsLoading && !hasInitialFeed) {
      return "Loading recent activities...";
    }
    return null;
  }, [displayResults, effectiveIsLoading, feedFilter]);

  return (
    <div className="space-y-4">
      {/* Twitter-like Feed Filter Tabs */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 border-b border-zinc-800 bg-black/80 backdrop-blur">
        <div className="flex">
          <button
            onClick={() => setFeedFilter('all')}
            className={cn(
              'relative flex-1 py-4 text-center text-sm font-medium transition-colors hover:bg-zinc-900/50',
              feedFilter === 'all' ? 'text-white' : 'text-zinc-500'
            )}
          >
            All
            {feedFilter === 'all' && (
              <div className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-indigo-500" />
            )}
          </button>
          <button
            onClick={() => setFeedFilter('following')}
            className={cn(
              'relative flex-1 py-4 text-center text-sm font-medium transition-colors hover:bg-zinc-900/50',
              feedFilter === 'following' ? 'text-white' : 'text-zinc-500'
            )}
          >
            Following
            {feedFilter === 'following' && (
              <div className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-indigo-500" />
            )}
          </button>
        </div>
      </div>

      {hasNewActivity && (
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

      {displayResults?.filter((item): item is NonNullable<typeof item> & { user: NonNullable<(typeof item)['user']> } => item.user !== null).map((item) => (
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
          }}
          onToggleLike={handleToggleLike}
          isLiking={!!pendingLikes[item.activity._id]}
          mentionOptions={mentionUsers}
        />
      ))}

      {!effectiveIsLoading && (displayResults?.length ?? 0) === 0 && (
        <Card className="border-dashed text-center">
          <CardHeader>
            <CardTitle>
              {feedFilter === 'following' ? 'No activity from people you follow' : 'No activity yet'}
            </CardTitle>
            <CardDescription>
              {feedFilter === 'following'
                ? 'Follow other participants to see their activities here.'
                : 'Be the first to log a workout for this challenge.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={effectiveIsLoading}>
            {effectiveIsLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper to format metric values with units
function formatMetricValue(metrics: Record<string, unknown> | undefined, scoringConfig: Record<string, unknown> | undefined): string | null {
  if (!metrics || !scoringConfig) return null;

  const unit = scoringConfig.unit as string | undefined;
  if (!unit) return null;

  const value = metrics[unit];
  if (value === undefined || value === null) return null;

  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return null;

  // Format based on unit type
  const unitLabels: Record<string, string> = {
    miles: 'mi',
    kilometers: 'km',
    km: 'km',
    minutes: 'min',
    hours: 'hr',
    drinks: 'drinks',
    completion: '',
    completions: '',
  };

  const label = unitLabels[unit] || unit;
  const formatted = numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);

  return label ? `${formatted} ${label}` : formatted;
}

function ActivityStats({ item }: { item: ActivityFeedItem }) {
  const metricDisplay = formatMetricValue(
    item.activity.metrics,
    item.activityType?.scoringConfig
  );

  const hasBonuses = item.activity.triggeredBonuses && item.activity.triggeredBonuses.length > 0;
  const bonusTotal = hasBonuses
    ? item.activity.triggeredBonuses!.reduce((sum, b) => sum + b.bonusPoints, 0)
    : 0;
  return (
    <div className="rounded-lg bg-muted px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {metricDisplay && (
            <span className="font-semibold text-foreground">{metricDisplay}</span>
          )}
          <PointsDisplay
            points={item.activity.pointsEarned}
            isNegative={item.activityType?.isNegative}
            decimals={1}
            size="sm"
            showSign={false}
            hasBonuses={!!hasBonuses}
            className="font-medium"
          />
          {hasBonuses && (
            <span className="text-xs text-muted-foreground">
              (incl. +{bonusTotal} bonus)
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(item.activity.createdAt), {
            addSuffix: true,
          })}
        </div>
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
  );
}

interface ActivityCardProps {
  challengeId: string;
  item: ActivityFeedItem;
  showEngagementCounts: boolean;
  onToggleLike: (activityId: string, shouldLike: boolean) => Promise<void> | void;
  isLiking: boolean;
  mentionOptions: MentionableUser[];
}

function ActivityCard({
  challengeId,
  item,
  showEngagementCounts,
  onToggleLike,
  isLiking,
  mentionOptions,
}: ActivityCardProps) {
  const activityId = item.activity.id ?? item.activity._id;
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagCategory, setFlagCategory] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);

  const flagActivity = useMutation(api.mutations.activities.flagActivity);

  const activityUrl = `/challenges/${challengeId}/activities/${activityId}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('textarea') ||
      target.closest('input')
    ) {
      return;
    }
    router.push(activityUrl);
  };

  const handleFlagSubmit = async () => {
    if (!flagCategory) return;
    if (flagCategory === 'other' && !flagReason.trim()) return;
    setFlagSubmitting(true);
    setFlagError(null);
    const categoryLabel =
      flagCategory === 'incorrect_type'
        ? 'Logged as incorrect type'
        : flagCategory === 'impossible'
          ? 'Seems like an impossible feat of athleticism'
          : '';
    const reason = flagCategory === 'other'
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
      setFlagReason('');
    } catch (err) {
      setFlagError(
        err instanceof ConvexError ? (err.data as string) :
        err instanceof Error ? err.message : 'Failed to report activity'
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
          title: 'Check out this activity',
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      console.error('Share failed', error);
    }
  };

  return (
    <Card className="cursor-pointer overflow-hidden transition-colors hover:bg-muted/30" onClick={handleCardClick}>
      <CardHeader>
        <UserAvatarInline
          user={item.user}
          challengeId={challengeId}
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
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {item.activityType?.name ?? 'Activity'}
          </p>
          {item.activity.notes ? (
            <RichTextViewer
              content={item.activity.notes}
              className="mt-2 text-sm text-muted-foreground"
            />
          ) : null}
        </div>

        {/* Media Gallery */}
        {item.mediaUrls && item.mediaUrls.length > 0 && (
          <div
            className={cn(
              'grid gap-2',
              item.mediaUrls.length === 1 && 'grid-cols-1',
              item.mediaUrls.length === 2 && 'grid-cols-2',
              item.mediaUrls.length >= 3 && 'grid-cols-2'
            )}
          >
            {item.mediaUrls.slice(0, 4).map((url, index) => {
              const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') || url.includes('video');
              const isLastWithMore = index === 3 && item.mediaUrls.length > 4;

              return (
                <div
                  key={index}
                  className={cn(
                    'relative overflow-hidden rounded-lg bg-zinc-900',
                    item.mediaUrls.length === 1
                      ? 'aspect-video'
                      : 'aspect-square',
                    item.mediaUrls.length === 3 && index === 0 && 'row-span-2'
                  )}
                >
                  {isVideo ? (
                    <video
                      src={url}
                      className="h-full w-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={url}
                      alt={`Activity media ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {isLastWithMore && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <span className="text-lg font-semibold text-white">
                        +{item.mediaUrls.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ActivityStats item={item} />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          variant={item.likedByUser ? 'default' : 'outline'}
          size="sm"
          disabled={isLiking}
          onClick={() => onToggleLike(activityId, !item.likedByUser)}
        >
          <ThumbsUp
            className={cn('mr-2 h-4 w-4', item.likedByUser && 'fill-current')}
          />
          {showEngagementCounts ? item.likes : 'Like'}
        </Button>
        <Button
          variant={showComments ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowComments((prev) => !prev)}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {showEngagementCounts ? item.comments : 'Comment'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setFlagSuccess(false);
                setFlagError(null);
                setFlagCategory('');
                setFlagReason('');
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
                Flag this activity for admin review. Please describe why you think
                this activity should be reviewed.
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
                <RadioGroup value={flagCategory} onValueChange={setFlagCategory}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incorrect_type" id="feed-flag-incorrect" />
                    <Label htmlFor="feed-flag-incorrect">Logged as incorrect type</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="impossible" id="feed-flag-impossible" />
                    <Label htmlFor="feed-flag-impossible">Seems like an impossible feat of athleticism</Label>
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
                    disabled={flagSubmitting || !flagCategory || (flagCategory === 'other' && !flagReason.trim())}
                  >
                    {flagSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting
                      </>
                    ) : (
                      'Submit Report'
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>

      {showComments && (
        <CardContent className="border-t bg-muted/40" onClick={(e) => e.stopPropagation()}>
           <ActivityComments
              activityId={activityId}
              challengeId={challengeId}
              mentionOptions={mentionOptions}
            />
        </CardContent>
      )}
    </Card>
  );
}

function ActivityComments({
    activityId,
    challengeId,
    mentionOptions
}: {
    activityId: string;
    challengeId: string;
    mentionOptions: MentionableUser[];
}) {
    const [commentInput, setCommentInput] = useState('');
    const [commentIsEmpty, setCommentIsEmpty] = useState(true);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);

    const {
        results: comments,
        status: commentsStatus,
        loadMore: loadMoreComments,
        isLoading: loadingComments
    } = usePaginatedQuery(
        api.queries.comments.getByActivityId,
        { activityId: activityId as Id<"activities"> },
        { initialNumItems: 5 }
    );

    const createComment = useMutation(api.mutations.comments.create);

    const handleSubmitComment = async () => {
        if (!commentInput || commentIsEmpty || isEditorContentEmpty(commentInput)) return;

        try {
            setSubmittingComment(true);
            setCommentError(null);
            
            await createComment({
                activityId: activityId as Id<"activities">,
                content: commentInput
            });

            setCommentInput('');
            setCommentIsEmpty(true);
        } catch (err) {
            console.error(err);
            setCommentError(
                err instanceof Error ? err.message : 'Unable to post comment',
            );
        } finally {
            setSubmittingComment(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <RichTextEditor
                value={commentInput}
                onChange={setCommentInput}
                onIsEmptyChange={setCommentIsEmpty}
                placeholder="Leave an encouraging note"
                disabled={submittingComment}
                mentionOptions={mentionOptions}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                {commentError ? <span className="text-destructive">{commentError}</span> : <span>Cheer on your teammates!</span>}
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
                    'Comment'
                    )}
                </Button>
                </div>
            </div>

            <div className="space-y-3">
                {comments?.map((entry: { comment: { id: string; createdAt: number; content: string }; author: { id: string; name: string; username: string; avatarUrl: string | null } }) => (
                <div key={entry.comment.id} className="flex gap-3">
                    <UserAvatar
                      user={{
                        id: entry.author.id,
                        name: entry.author.name,
                        username: entry.author.username,
                        avatarUrl: entry.author.avatarUrl,
                      }}
                      challengeId={challengeId}
                      size="sm"
                    />
                    <div className="flex-1 rounded-lg bg-background p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {entry.author.name ?? entry.author.username}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.comment.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <RichTextViewer
                        content={entry.comment.content}
                        className="mt-1 text-sm text-muted-foreground"
                      />
                    </div>
                </div>
                ))}

                {loadingComments && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading comments…
                </div>
                )}

                {commentsStatus === "CanLoadMore" && !loadingComments && (
                <div className="flex justify-center">
                    <Button
                    variant="link"
                    size="sm"
                    onClick={() => loadMoreComments(5)}
                    >
                    Load more replies
                    </Button>
                </div>
                )}

                {!loadingComments && comments?.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                    No comments yet. Start the conversation!
                </p>
                )}
            </div>
        </div>
    );
}
