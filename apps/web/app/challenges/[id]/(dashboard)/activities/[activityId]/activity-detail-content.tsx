"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  formatDateOnlyFromUtcMs,
  formatDateShortFromDateOnly,
} from "@/lib/date-only";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Share2,
  Shield,
  ThumbsUp,
  Trophy,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { UserAvatar, UserAvatarInline } from "@/components/user-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";
import {
  isEditorContentEmpty,
  type MentionableUser,
} from "@/lib/rich-text-utils";
import { cn } from "@/lib/utils";
import { formatPoints } from "@/lib/points";
import { PointsDisplay } from "@/components/ui/points-display";
import { MediaGallery } from "@/components/media-gallery";
import { LikesDisplay } from "@/components/likes-display";
import { ActivityShareDialog } from "@/components/activity-share-dialog";
import type { ShareCardData } from "@/lib/share-card-renderer";
import { getOptimizedMediaUrl } from "@/lib/media-optimizer";
import { useChallengeSummary } from "@/components/dashboard/challenge-realtime-context";

interface MediaPreview {
  file: File;
  url: string;
  type: "image" | "video";
}

interface ExistingMedia {
  storageId: string;
  url: string;
  type: "image" | "video";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

function isVideoUrl(url: string): boolean {
  return (
    url.includes(".mp4") ||
    url.includes(".mov") ||
    url.includes(".webm") ||
    url.includes("video")
  );
}

interface ActivityDetailContentProps {
  challengeId: string;
  activityId: string;
}

export function ActivityDetailContent({
  challengeId,
  activityId,
}: ActivityDetailContentProps) {
  const [pendingLike, setPendingLike] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagCategory, setFlagCategory] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editNotesIsEmpty, setEditNotesIsEmpty] = useState(true);
  const [editLoggedDate, setEditLoggedDate] = useState("");
  const [editMetricValue, setEditMetricValue] = useState("");
  const [editActivityTypeId, setEditActivityTypeId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editExistingMedia, setEditExistingMedia] = useState<ExistingMedia[]>(
    [],
  );
  const [editNewMedia, setEditNewMedia] = useState<MediaPreview[]>([]);
  const [editUploadProgress, setEditUploadProgress] = useState<string | null>(
    null,
  );
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const activityData = useQuery(api.queries.activities.getById, {
    activityId: activityId as Id<"activities">,
  });

  // Defer loading activity types until the edit dialog is opened (bundle-conditional)
  const challengeActivityTypes = useQuery(
    api.queries.activityTypes.getByChallengeId,
    showEditDialog ? { challengeId: challengeId as Id<"challenges"> } : "skip",
  );

  const { users: mentionUsers } = useMentionableUsers(challengeId);
  const { summary } = useChallengeSummary();

  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightCommentId = searchParams.get("commentId");

  const toggleLike = useMutation(api.mutations.likes.toggle);
  const flagActivity = useMutation(api.mutations.activities.flagActivity);
  const deleteActivity = useMutation(api.mutations.activities.remove);
  const editActivityMutation = useMutation(
    api.mutations.activities.editActivity,
  );
  const generateUploadUrl = useMutation(
    api.mutations.activities.generateUploadUrl,
  );

  const handleEditFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newFiles: MediaPreview[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`File "${file.name}" is not a supported format`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File "${file.name}" exceeds 50MB limit`);
          continue;
        }
        const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
        newFiles.push({
          file,
          url: URL.createObjectURL(file),
          type: isVideo ? "video" : "image",
        });
      }

      setEditNewMedia((prev) =>
        [...prev, ...newFiles].slice(0, 4 - editExistingMedia.length),
      );
    },
    [editExistingMedia.length],
  );

  const handleRemoveExistingMedia = useCallback((index: number) => {
    setEditExistingMedia((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveNewMedia = useCallback((index: number) => {
    setEditNewMedia((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleToggleLike = async () => {
    setPendingLike(true);
    try {
      await toggleLike({ activityId: activityId as Id<"activities"> });
    } catch (error) {
      console.error("Failed to toggle like", error);
    } finally {
      setPendingLike(false);
    }
  };

  const shareCardData: ShareCardData | null = useMemo(() => {
    if (!activityData) return null;
    const { activity: act, user: u, activityType: at, challenge: ch } = activityData;

    // Pick the first non-video image for the share card background
    let mediaUrl: string | null = null;
    const cIds = (activityData as { cloudinaryPublicIds?: string[] }).cloudinaryPublicIds;
    if (cIds?.length) {
      const imageId = cIds.find((id: string) => !id.startsWith("v/"));
      if (imageId) {
        mediaUrl = getOptimizedMediaUrl(imageId, "full");
      }
    }
    const mUrls = (activityData as { mediaUrls?: string[] }).mediaUrls;
    if (!mediaUrl && mUrls?.length) {
      mediaUrl = mUrls[0];
    }

    return {
      activityTypeName: at.name,
      pointsEarned: act.pointsEarned,
      loggedDate: new Date(act.loggedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      metrics: act.metrics as Record<string, unknown> | undefined,
      userName: u.name ?? u.username,
      challengeName: ch.name,
      mediaUrl,
      triggeredBonuses: act.triggeredBonuses as { metric: string; threshold: number; bonusPoints: number }[] | undefined,
      rank: summary.stats.userRank,
      totalParticipants: summary.stats.totalParticipants,
      totalPoints: summary.stats.userPoints,
      currentStreak: summary.stats.userStreak,
    };
  }, [activityData, summary.stats]);

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

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteActivity({ activityId: activityId as Id<"activities"> });
      router.push(`/challenges/${challengeId}/dashboard`);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete activity",
      );
      setDeleteSubmitting(false);
    }
  };

  const openEditDialog = () => {
    if (!activityData || activityData === null) return;
    const {
      activity,
      activityType,
      mediaUrls: existingUrls,
    } = activityData as {
      activity: {
        notes?: string;
        loggedDate: number;
        metrics?: Record<string, unknown>;
        pointsEarned: number;
        mediaIds?: string[];
      };
      activityType: { _id: string; scoringConfig: Record<string, unknown> };
      mediaUrls?: string[];
    };
    setEditNotes(typeof activity.notes === "string" ? activity.notes : "");
    setEditNotesIsEmpty(!activity.notes || activity.notes.trim() === "");
    setEditLoggedDate(formatDateOnlyFromUtcMs(activity.loggedDate));
    setEditActivityTypeId(activityType._id);
    // Pre-populate metric value from existing metrics
    const config = activityType.scoringConfig ?? {};
    const unit = config["unit"] as string | undefined;
    const metrics = (activity.metrics ?? {}) as Record<string, unknown>;
    const metricVal = unit ? (metrics[unit] ?? "") : "";
    setEditMetricValue(String(metricVal));
    // Pre-populate existing media
    const mediaIds = activity.mediaIds ?? [];
    const urls = existingUrls ?? [];
    setEditExistingMedia(
      urls.map((url: string, i: number) => ({
        storageId: mediaIds[i] ?? "",
        url,
        type: isVideoUrl(url) ? ("video" as const) : ("image" as const),
      })),
    );
    setEditNewMedia([]);
    setEditUploadProgress(null);
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!activityData || activityData === null) return;
    setEditSubmitting(true);
    try {
      const { activityType, activity } = activityData as {
        activityType: { _id: string; scoringConfig: Record<string, unknown> };
        activity: { mediaIds?: string[] };
      };
      const config = (activityType.scoringConfig ?? {}) as Record<
        string,
        unknown
      >;
      const unit = config["unit"] as string | undefined;

      // Build metrics from the metric input
      let newMetrics: Record<string, unknown> | undefined;
      if (unit && editMetricValue !== "") {
        newMetrics = { [unit]: Number(editMetricValue) };
      }

      // Upload new media files
      const uploadedIds: Id<"_storage">[] = [];
      if (editNewMedia.length > 0) {
        setEditUploadProgress(`Uploading ${editNewMedia.length} file(s)...`);
        for (let i = 0; i < editNewMedia.length; i++) {
          setEditUploadProgress(
            `Uploading file ${i + 1} of ${editNewMedia.length}...`,
          );
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": editNewMedia[i].file.type },
            body: editNewMedia[i].file,
          });
          if (!response.ok) throw new Error(`Failed to upload file ${i + 1}`);
          const { storageId } = await response.json();
          uploadedIds.push(storageId);
        }
        setEditUploadProgress(null);
      }

      // Build final mediaIds: kept existing + newly uploaded
      const keptExistingIds = editExistingMedia
        .map((m) => m.storageId)
        .filter(Boolean) as Id<"_storage">[];
      const finalMediaIds = [...keptExistingIds, ...uploadedIds];

      // Only send mediaIds if they actually changed
      const originalIds = activity.mediaIds ?? [];
      const mediaChanged =
        finalMediaIds.length !== originalIds.length ||
        finalMediaIds.some((id, i) => id !== originalIds[i]);

      const payload: Parameters<typeof editActivityMutation>[0] = {
        activityId: activityId as Id<"activities">,
        notes:
          editNotesIsEmpty || isEditorContentEmpty(editNotes) ? "" : editNotes,
        loggedDate: editLoggedDate,
        ...(editActivityTypeId !== activityType._id
          ? { activityTypeId: editActivityTypeId as Id<"activityTypes"> }
          : {}),
        ...(newMetrics !== undefined ? { metrics: newMetrics } : {}),
        ...(mediaChanged ? { mediaIds: finalMediaIds } : {}),
      };

      const result = await editActivityMutation(payload);

      // Clean up new media preview URLs
      editNewMedia.forEach((media) => URL.revokeObjectURL(media.url));
      setEditNewMedia([]);

      toast.success(
        `Activity updated! ${formatPoints(result.pointsEarned, 2)} pts.`,
      );
      setShowEditDialog(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update activity",
      );
      setEditUploadProgress(null);
    } finally {
      setEditSubmitting(false);
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

  const {
    activity,
    user,
    activityType,
    challenge,
    likes,
    comments,
    likedByUser,
    mediaUrls,
    cloudinaryPublicIds,
    recentLikers,
    adminComment,
    isAdmin,
    isOwner,
  } = activityData;

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
        <div>
          <div className="flex items-start gap-4">
            <UserAvatarInline
              user={user}
              challengeId={challengeId}
              size="xl"
              suffix={
                <>
                  <span aria-hidden="true">·</span>
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
          </div>

          <div className="mt-4 space-y-4">
            {/* Points & date row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Trophy
                  className={cn(
                    "h-4 w-4",
                    activityType.isNegative || activity.pointsEarned < 0
                      ? "text-red-500"
                      : "text-yellow-500",
                  )}
                />
                <PointsDisplay
                  points={activity.pointsEarned}
                  isNegative={activityType.isNegative}
                  decimals={2}
                  size="lg"
                  showSign={true}
                  showLabel={true}
                  className="font-semibold"
                />
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-500" />
                {formatDateShortFromDateOnly(
                  formatDateOnlyFromUtcMs(activity.loggedDate),
                )}
              </span>
              {activity.source !== "manual" && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    via <span className="capitalize">{activity.source}</span>
                  </span>
                </>
              )}
            </div>

            {/* Metrics inline */}
            {metrics && Object.keys(metrics).length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {Object.entries(metrics).map(([key, value]) => (
                  <span key={key} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {typeof value === "number"
                        ? value.toLocaleString()
                        : String(value)}
                    </span>{" "}
                    <span className="capitalize">{key.replace(/_/g, " ")}</span>
                  </span>
                ))}
              </div>
            )}

            {activity.notes && (
              <RichTextViewer
                content={activity.notes}
                className="text-base"
              />
            )}

            {/* Media Gallery */}
            <MediaGallery urls={mediaUrls ?? []} optimizedMediaIds={cloudinaryPublicIds} variant="detail" />

            {adminComment && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-500">
                    Admin Note
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {adminComment}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              variant={likedByUser ? "default" : "outline"}
              size="sm"
              disabled={pendingLike}
              onClick={handleToggleLike}
            >
              <ThumbsUp
                className={cn("mr-2 h-4 w-4", likedByUser && "fill-current")}
              />
              {likes} {likes === 1 ? "Like" : "Likes"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#comments">
                <MessageCircle className="mr-2 h-4 w-4" />
                {comments} {comments === 1 ? "Comment" : "Comments"}
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowShareDialog(true)}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 w-8 p-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner && (
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit activity
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <DropdownMenuItem
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete activity
                  </DropdownMenuItem>
                )}
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

              {/* Edit Activity Dialog - ResponsiveDialog for mobile support */}
              <ResponsiveDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
              >
                <ResponsiveDialogContent>
                  <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Edit Activity</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                      Update the details for this activity. Points will be
                      recalculated automatically.
                    </ResponsiveDialogDescription>
                  </ResponsiveDialogHeader>
                  <ResponsiveDialogBody className="space-y-4">
                    {/* Activity Type */}
                    <div className="space-y-1">
                      <Label htmlFor="edit-activity-type">Activity Type</Label>
                      <Select
                        value={editActivityTypeId}
                        onValueChange={setEditActivityTypeId}
                      >
                        <SelectTrigger id="edit-activity-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {challengeActivityTypes?.map(
                            (at: { _id: string; name: string }) => (
                              <SelectItem key={at._id} value={at._id}>
                                {at.name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Logged Date */}
                    <div className="space-y-1">
                      <Label htmlFor="edit-logged-date">Date</Label>
                      <Input
                        id="edit-logged-date"
                        type="date"
                        value={editLoggedDate}
                        onChange={(e) => setEditLoggedDate(e.target.value)}
                      />
                    </div>

                    {/* Metric Value */}
                    {(() => {
                      const at = challengeActivityTypes?.find(
                        (a: { _id: string }) => a._id === editActivityTypeId,
                      );
                      const config = (at?.scoringConfig ?? {}) as Record<
                        string,
                        unknown
                      >;
                      const unit = config["unit"] as string | undefined;
                      if (!unit) return null;
                      return (
                        <div className="space-y-1">
                          <Label htmlFor="edit-metric">
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </Label>
                          <Input
                            id="edit-metric"
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={editMetricValue}
                            onChange={(e) => setEditMetricValue(e.target.value)}
                            placeholder={`Enter ${unit}`}
                          />
                        </div>
                      );
                    })()}

                    {/* Notes - Rich Text Editor with mentions */}
                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <RichTextEditor
                        value={editNotes}
                        onChange={setEditNotes}
                        onIsEmptyChange={setEditNotesIsEmpty}
                        placeholder="Add notes about this activity..."
                        mentionOptions={mentionUsers}
                      />
                    </div>

                    {/* Media Upload Section */}
                    <div className="space-y-2">
                      <Label>Photos & Videos</Label>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleEditFileSelect(e.target.files);
                          e.target.value = "";
                        }}
                      />

                      {/* Media Preview Grid - existing + new */}
                      {(editExistingMedia.length > 0 ||
                        editNewMedia.length > 0) && (
                        <div className="grid grid-cols-2 gap-2">
                          {editExistingMedia.map((media, index) => (
                            <div
                              key={`existing-${media.storageId}`}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
                            >
                              {media.type === "video" ? (
                                <video
                                  src={media.url}
                                  className="h-full w-full object-cover"
                                  muted
                                />
                              ) : (
                                <img
                                  src={media.url}
                                  alt={`Media ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveExistingMedia(index)}
                                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 hover:bg-black"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              {media.type === "video" && (
                                <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                                  Video
                                </div>
                              )}
                            </div>
                          ))}
                          {editNewMedia.map((media, index) => (
                            <div
                              key={`new-${index}`}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-dashed border-zinc-600 bg-zinc-900"
                            >
                              {media.type === "image" ? (
                                <img
                                  src={media.url}
                                  alt={`New upload ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <video
                                  src={media.url}
                                  className="h-full w-full object-cover"
                                  muted
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveNewMedia(index)}
                                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 hover:bg-black"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              {media.type === "video" && (
                                <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                                  Video
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Media Button */}
                      {editExistingMedia.length + editNewMedia.length < 4 && (
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 py-4 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-300"
                        >
                          <ImagePlus className="h-5 w-5" />
                          <span>Add photos or videos</span>
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Up to 4 files. Max 50MB each. JPEG, PNG, GIF, WebP, MP4,
                        MOV, WebM.
                      </p>
                    </div>

                    {editUploadProgress && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {editUploadProgress}
                      </div>
                    )}
                  </ResponsiveDialogBody>
                  <ResponsiveDialogFooter>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setShowEditDialog(false)}
                      disabled={editSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={handleEditSubmit}
                      disabled={editSubmitting}
                    >
                      {editSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editUploadProgress ? "Uploading..." : "Saving"}
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </ResponsiveDialogFooter>
                </ResponsiveDialogContent>
              </ResponsiveDialog>
            </DropdownMenu>
          </div>

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
                      Thank you for your report. An admin will review this
                      activity.
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
                          id="flag-incorrect"
                        />
                        <Label htmlFor="flag-incorrect">
                          Logged as incorrect type
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="impossible"
                          id="flag-impossible"
                        />
                        <Label htmlFor="flag-impossible">
                          Seems like an impossible feat of athleticism
                        </Label>
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

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete activity?</DialogTitle>
                  <DialogDescription>
                    This removes the activity from your logs and leaderboards.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                {deleteError && (
                  <Alert variant="destructive">
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={deleteSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={handleDelete}
                    disabled={deleteSubmitting}
                  >
                    {deleteSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting
                      </>
                    ) : (
                      "Delete activity"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
        {likes > 0 && (
          <LikesDisplay
            activityId={activityId}
            challengeId={challengeId}
            likes={likes}
            likedByUser={likedByUser}
            recentLikers={recentLikers ?? []}
          />
        )}

        {isAdmin && (
          <AdminEditSection
            activityId={activityId}
            challengeId={challengeId}
            currentActivityTypeId={activityType.id}
            currentPoints={activity.pointsEarned}
            currentNotes={activity.notes ?? ""}
            currentLoggedDate={activity.loggedDate}
          />
        )}

        <div id="comments" className="border-t pt-6">
          <h2 className="text-lg font-semibold">Comments</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Leave an encouraging message for {user.name ?? user.username}
          </p>
          <ActivityComments
            activityId={activityId}
            challengeId={challengeId}
            mentionOptions={mentionUsers}
            highlightCommentId={highlightCommentId}
          />
        </div>
      </div>
      {shareCardData && (
        <ActivityShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          data={shareCardData}
        />
      )}
    </div>
  );
}

function ActivityComments({
  activityId,
  challengeId,
  mentionOptions,
  highlightCommentId,
}: {
  activityId: string;
  challengeId: string;
  mentionOptions: MentionableUser[];
  highlightCommentId?: string | null;
}) {
  const [commentInput, setCommentInput] = useState("");
  const [commentIsEmpty, setCommentIsEmpty] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const didScrollRef = useRef(false);

  const {
    results: comments,
    status: commentsStatus,
    loadMore: loadMoreComments,
    isLoading: loadingComments,
  } = usePaginatedQuery(
    api.queries.comments.getByActivityId,
    { activityId: activityId as Id<"activities"> },
    { initialNumItems: 10 },
  );

  useEffect(() => {
    if (!highlightCommentId || didScrollRef.current || !comments?.length) return;
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) {
      didScrollRef.current = true;
      setHighlightedId(highlightCommentId);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightCommentId, comments]);

  const createComment = useMutation(api.mutations.comments.create);
  const toggleCommentLike = useMutation(api.mutations.commentLikes.toggle);

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
              "Comment"
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {comments?.map(
          (entry: {
            comment: { id: string; createdAt: string; content: string };
            author: {
              id: string;
              name: string;
              username: string;
              avatarUrl: string | null;
            };
            likeCount: number;
            likedByMe: boolean;
          }) => (
            <div
              key={entry.comment.id}
              id={`comment-${entry.comment.id}`}
              className={cn(
                "flex gap-3 rounded-lg transition-colors duration-700",
                highlightedId === entry.comment.id && "bg-indigo-500/20 ring-1 ring-indigo-500/40",
              )}
            >
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
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() =>
                      toggleCommentLike({
                        commentId: entry.comment.id as Id<"comments">,
                      })
                    }
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${entry.likedByMe ? "fill-red-500 text-red-500" : ""}`}
                    />
                    {entry.likeCount > 0 && <span>{entry.likeCount}</span>}
                  </button>
                </div>
              </div>
            </div>
          ),
        )}

        {loadingComments && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        )}

        {commentsStatus === "CanLoadMore" && !loadingComments && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMoreComments(10)}
            >
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
    formatDateOnlyFromUtcMs(currentLoggedDate),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });
  const editActivity = useMutation(api.mutations.admin.adminEditActivity);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {
        activityId: activityId as Id<"activities">,
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

      const currentDateStr = formatDateOnlyFromUtcMs(currentLoggedDate);
      if (loggedDate !== currentDateStr) {
        payload.loggedDate = loggedDate;
      }

      await editActivity(payload as Parameters<typeof editActivity>[0]);
      setMessage("Activity updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update activity.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
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
            <Alert variant={error ? "destructive" : "default"}>
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
                "Save Changes"
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
