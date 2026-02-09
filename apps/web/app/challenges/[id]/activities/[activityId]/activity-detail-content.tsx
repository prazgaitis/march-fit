'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { useMutation, useQuery, usePaginatedQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Share2,
  Shield,
  ThumbsUp,
  Trophy,
} from 'lucide-react';

import { ConvexError } from 'convex/values';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { RichTextViewer } from '@/components/editor/rich-text-viewer';
import { UserAvatar, UserAvatarInline } from '@/components/user-avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMentionableUsers } from '@/hooks/use-mentionable-users';
import { isEditorContentEmpty, type MentionableUser } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface ActivityDetailContentProps {
  challengeId: string;
  activityId: string;
}

export function ActivityDetailContent({
  challengeId,
  activityId,
}: ActivityDetailContentProps) {
  const activityData = useQuery(api.queries.activities.getById, {
    activityId: activityId as Id<'activities'>,
  });

  const { users: mentionUsers } = useMentionableUsers(challengeId);
  const [pendingLike, setPendingLike] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagCategory, setFlagCategory] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);

  const toggleLike = useMutation(api.mutations.likes.toggle);
  const flagActivity = useMutation(api.mutations.activities.flagActivity);

  const handleToggleLike = async () => {
    setPendingLike(true);
    try {
      await toggleLike({ activityId: activityId as Id<'activities'> });
    } catch (error) {
      console.error('Failed to toggle like', error);
    } finally {
      setPendingLike(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;

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
        activityId: activityId as Id<'activities'>,
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

  if (activityData === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activityData === null) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Activity not found</CardTitle>
          <CardDescription>
            This activity may have been deleted or you don&apos;t have
            permission to view it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/challenges/${challengeId}/dashboard`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { activity, user, activityType, challenge, likes, comments, likedByUser, mediaUrls, adminComment, isAdmin } =
    activityData;

  const metrics = activity.metrics as Record<string, unknown> | undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/challenges/${challengeId}/dashboard`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/challenges/${challengeId}/dashboard`}
              className="hover:underline"
            >
              {challenge.name}
            </Link>
          </p>
          <h1 className="text-xl font-bold">{activityType.name}</h1>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start gap-4">
            <UserAvatarInline
              user={user}
              challengeId={challengeId}
              size="xl"
              suffix={
                <>
                  <span aria-hidden="true">•</span>
                  <span>
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </>
              }
              className="flex-1"
            />
            {activityType.isNegative ? (
              <Badge variant="destructive">Penalty</Badge>
            ) : (
              <Badge variant="secondary">{activityType.name}</Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {activity.notes && (
              <div>
                <RichTextViewer
                  content={activity.notes}
                  className="text-base"
                />
              </div>
            )}

            {/* Media Gallery */}
            {mediaUrls && mediaUrls.length > 0 && (
              <div
                className={cn(
                  'grid gap-2',
                  mediaUrls.length === 1 && 'grid-cols-1',
                  mediaUrls.length === 2 && 'grid-cols-2',
                  mediaUrls.length >= 3 && 'grid-cols-2'
                )}
              >
                {mediaUrls.map((url: string, index: number) => {
                  const isVideo =
                    url.includes('.mp4') ||
                    url.includes('.mov') ||
                    url.includes('.webm') ||
                    url.includes('video');

                  return (
                    <div
                      key={index}
                      className={cn(
                        'relative overflow-hidden rounded-lg bg-zinc-900',
                        mediaUrls.length === 1 ? 'aspect-video' : 'aspect-square',
                        mediaUrls.length === 3 && index === 0 && 'row-span-2'
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`Activity media ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {activity.pointsEarned.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Points earned
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-lg font-semibold">
                    {format(new Date(activity.loggedDate), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Activity date
                  </p>
                </div>
              </div>
            </div>

            {metrics && Object.keys(metrics).length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Activity metrics
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(metrics).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border bg-muted/20 px-4 py-3"
                    >
                      <p className="text-lg font-semibold">
                        {typeof value === 'number'
                          ? value.toLocaleString()
                          : String(value)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activity.source !== 'manual' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Synced from{' '}
                  <span className="capitalize">{activity.source}</span>
                </span>
              </div>
            )}

            {adminComment && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-500">Admin Note</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {adminComment}
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              variant={likedByUser ? 'default' : 'outline'}
              size="sm"
              disabled={pendingLike}
              onClick={handleToggleLike}
            >
              <ThumbsUp
                className={cn('mr-2 h-4 w-4', likedByUser && 'fill-current')}
              />
              {likes} {likes === 1 ? 'Like' : 'Likes'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#comments">
                <MessageCircle className="mr-2 h-4 w-4" />
                {comments} {comments === 1 ? 'Comment' : 'Comments'}
              </a>
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
                        <RadioGroupItem value="incorrect_type" id="flag-incorrect" />
                        <Label htmlFor="flag-incorrect">Logged as incorrect type</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="impossible" id="flag-impossible" />
                        <Label htmlFor="flag-impossible">Seems like an impossible feat of athleticism</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="flag-other" />
                        <Label htmlFor="flag-other">Other</Label>
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
        </Card>

        {isAdmin && (
          <AdminEditSection
            activityId={activityId}
            challengeId={challengeId}
            currentActivityTypeId={activityType.id}
            currentPoints={activity.pointsEarned}
            currentNotes={activity.notes ?? ''}
            currentLoggedDate={activity.loggedDate}
          />
        )}

        <Card id="comments">
          <CardHeader>
            <CardTitle>Comments</CardTitle>
            <CardDescription>
              Leave an encouraging message for {user.name ?? user.username}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityComments
              activityId={activityId}
              challengeId={challengeId}
              mentionOptions={mentionUsers}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActivityComments({
  activityId,
  challengeId,
  mentionOptions,
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
    isLoading: loadingComments,
  } = usePaginatedQuery(
    api.queries.comments.getByActivityId,
    { activityId: activityId as Id<'activities'> },
    { initialNumItems: 10 }
  );

  const createComment = useMutation(api.mutations.comments.create);

  const handleSubmitComment = async () => {
    if (!commentInput || commentIsEmpty || isEditorContentEmpty(commentInput))
      return;

    try {
      setSubmittingComment(true);
      setCommentError(null);

      await createComment({
        activityId: activityId as Id<'activities'>,
        content: commentInput,
      });

      setCommentInput('');
      setCommentIsEmpty(true);
    } catch (err) {
      console.error(err);
      setCommentError(
        err instanceof Error ? err.message : 'Unable to post comment'
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <RichTextEditor
          value={commentInput}
          onChange={setCommentInput}
          onIsEmptyChange={setCommentIsEmpty}
          placeholder="Write a comment..."
          disabled={submittingComment}
          mentionOptions={mentionOptions}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {commentError ? (
            <span className="text-destructive">{commentError}</span>
          ) : (
            <span>Cheer on your teammates!</span>
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
              'Comment'
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {comments?.map((entry: { comment: { _id: string; createdAt: number; content: string }; author: { id: string; name: string; username: string; avatarUrl: string | null } }) => (
          <div key={entry.comment._id} className="flex gap-3">
            <UserAvatar
              user={{
                id: entry.author.id,
                name: entry.author.name,
                username: entry.author.username,
                avatarUrl: entry.author.avatarUrl,
              }}
              challengeId={challengeId}
              size="md"
            />
            <div className="flex-1 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
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
                className="mt-2 text-sm text-muted-foreground"
              />
            </div>
          </div>
        ))}

        {loadingComments && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        )}

        {commentsStatus === 'CanLoadMore' && !loadingComments && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => loadMoreComments(10)}>
              Load more comments
            </Button>
          </div>
        )}

        {!loadingComments && comments?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to leave one!
          </p>
        )}
      </div>
    </div>
  );
}

function AdminEditSection({
  activityId,
  challengeId,
  currentActivityTypeId,
  currentPoints,
  currentNotes,
  currentLoggedDate,
}: {
  activityId: string;
  challengeId: string;
  currentActivityTypeId: string;
  currentPoints: number;
  currentNotes: string;
  currentLoggedDate: number;
}) {
  const [open, setOpen] = useState(false);
  const [activityTypeId, setActivityTypeId] = useState(currentActivityTypeId);
  const [points, setPoints] = useState(String(currentPoints));
  const [notes, setNotes] = useState(currentNotes);
  const [loggedDate, setLoggedDate] = useState(
    format(new Date(currentLoggedDate), 'yyyy-MM-dd')
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId: challengeId as Id<'challenges'>,
  });
  const editActivity = useMutation(api.mutations.admin.adminEditActivity);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {
        activityId: activityId as Id<'activities'>,
      };

      if (activityTypeId !== currentActivityTypeId) {
        payload.activityTypeId = activityTypeId;
      }

      const parsedPoints = Number(points);
      if (!Number.isNaN(parsedPoints) && parsedPoints !== currentPoints) {
        payload.pointsEarned = parsedPoints;
      }

      if (notes !== currentNotes) {
        payload.notes = notes || null;
      }

      const currentDateStr = format(new Date(currentLoggedDate), 'yyyy-MM-dd');
      if (loggedDate !== currentDateStr) {
        payload.loggedDate = loggedDate;
      }

      await editActivity(payload as Parameters<typeof editActivity>[0]);
      setMessage('Activity updated.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update activity.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Edit Activity (Admin)</CardTitle>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {(message || error) && (
            <Alert variant={error ? 'destructive' : 'default'}>
              <AlertDescription>{error ?? message}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin-activity-type">Activity Type</Label>
              <Select value={activityTypeId} onValueChange={setActivityTypeId}>
                <SelectTrigger id="admin-activity-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes?.map((at: { _id: string; name: string }) => (
                    <SelectItem key={at._id} value={at._id}>
                      {at.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="admin-points">Points Earned</Label>
              <Input
                id="admin-points"
                value={points}
                inputMode="decimal"
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="admin-date">Logged Date</Label>
              <Input
                id="admin-date"
                type="date"
                value={loggedDate}
                onChange={(e) => setLoggedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="admin-notes">Notes</Label>
            <Textarea
              id="admin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
