"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  forwardRef,
  useState,
  useImperativeHandle,
  useRef,
} from "react";
import { useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { formatDateOnlyFromUtcMs } from "@/lib/date-only";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  activityAdminCommentVisibilityValues,
  activityResolutionStatusValues,
} from "@/lib/validations";
import {
  Check,
  MessageCircle,
  Pencil,
  RotateCcw,
} from "lucide-react";

export interface FlaggedActivityActionsHandle {
  toggleComment: () => void;
  toggleEdit: () => void;
  resolve: () => void;
  /** Close whichever form is open. Returns true if something was closed. */
  closeOpen: () => boolean;
}

interface FlaggedActivityActionsProps {
  activityId: string;
  challengeId: string;
  currentStatus: (typeof activityResolutionStatusValues)[number];
  currentVisibility: (typeof activityAdminCommentVisibilityValues)[number];
  currentPoints: number;
  currentNotesContent: string;
  currentActivityTypeId: string;
  currentLoggedDate: number;
}

export const FlaggedActivityActions = forwardRef<
  FlaggedActivityActionsHandle,
  FlaggedActivityActionsProps
>(function FlaggedActivityActions(
  {
    activityId,
    challengeId,
    currentStatus,
    currentVisibility,
    currentPoints,
    currentNotesContent,
    currentActivityTypeId,
    currentLoggedDate,
  },
  ref,
) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState(currentVisibility);
  const [points, setPoints] = useState(String(currentPoints ?? 0));
  const [notes, setNotes] = useState(currentNotesContent ?? "");
  const [activityTypeId, setActivityTypeId] = useState(currentActivityTypeId);
  const [loggedDate, setLoggedDate] = useState(
    formatDateOnlyFromUtcMs(currentLoggedDate),
  );
  const [isPending, setIsPending] = useState(false);

  const commentFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });
  const updateResolution = useMutation(
    api.mutations.admin.updateFlagResolution,
  );
  const addComment = useMutation(api.mutations.admin.addAdminComment);
  const editActivity = useMutation(api.mutations.admin.adminEditActivity);

  const handleStatusChange = async (
    status: (typeof activityResolutionStatusValues)[number],
  ) => {
    setError(null);
    setMessage(null);
    setIsPending(true);

    try {
      await updateResolution({
        activityId: activityId as Id<"activities">,
        status,
      });
      setMessage(`Status updated to ${status}.`);
    } catch (err) {
      setError("Failed to update status. Please try again.");
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitComment();
  };

  const submitComment = async () => {
    if (!comment.trim()) {
      setError("Comment cannot be empty.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsPending(true);

    try {
      await addComment({
        activityId: activityId as Id<"activities">,
        comment,
        visibility,
      });
      setComment("");
      setShowComment(false);
      setMessage(
        visibility === "participant"
          ? "Comment added and participant notified."
          : "Internal comment added.",
      );
    } catch (err) {
      setError("Unable to add comment. Please try again.");
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitEdit();
  };

  const submitEdit = async () => {
    setError(null);
    setMessage(null);
    setIsPending(true);

    try {
      const payload: {
        activityId: Id<"activities">;
        activityTypeId?: Id<"activityTypes">;
        pointsEarned?: number;
        notes?: string | null;
        loggedDate?: string;
      } = {
        activityId: activityId as Id<"activities">,
      };

      if (activityTypeId !== currentActivityTypeId) {
        payload.activityTypeId = activityTypeId as Id<"activityTypes">;
      }

      if (points) {
        const parsedPoints = Number(points);
        if (!Number.isNaN(parsedPoints)) {
          payload.pointsEarned = parsedPoints;
        }
      }

      payload.notes = notes || null;

      const currentDateStr = formatDateOnlyFromUtcMs(currentLoggedDate);
      if (loggedDate !== currentDateStr) {
        payload.loggedDate = loggedDate;
      }

      await editActivity(payload);
      setShowEdit(false);
      setMessage("Activity details updated.");
    } catch (err) {
      setError("Failed to update activity details.");
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleTextareaKeyDown = (
    e: KeyboardEvent<HTMLTextAreaElement>,
    submit: () => Promise<void>,
  ) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  // Expose imperative methods for keyboard shortcuts
  useImperativeHandle(ref, () => ({
    toggleComment: () => {
      setShowComment((prev) => {
        if (!prev) setShowEdit(false);
        return !prev;
      });
    },
    toggleEdit: () => {
      setShowEdit((prev) => {
        if (!prev) setShowComment(false);
        return !prev;
      });
    },
    resolve: () => {
      if (isPending) return;
      const nextStatus =
        currentStatus === "pending" ? "resolved" : "pending";
      handleStatusChange(nextStatus);
    },
    closeOpen: () => {
      if (showComment) {
        setShowComment(false);
        return true;
      }
      if (showEdit) {
        setShowEdit(false);
        return true;
      }
      return false;
    },
  }));

  const isPendingReview = currentStatus === "pending";

  return (
    <div className="space-y-4">
      {(message || error) && (
        <Alert variant={error ? "destructive" : "default"}>
          <AlertDescription>{error ?? message}</AlertDescription>
        </Alert>
      )}

      {/* Primary action row — resolve/reopen + secondary toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {isPendingReview ? (
          <Button
            type="button"
            onClick={() => handleStatusChange("resolved")}
            disabled={isPending}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            Resolve
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleStatusChange("pending")}
            disabled={isPending}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Reopen
          </Button>
        )}

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          type="button"
          variant={showComment ? "secondary" : "ghost"}
          size="sm"
          onClick={() => {
            setShowComment(!showComment);
            if (!showComment) setShowEdit(false);
          }}
          className="gap-1.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Comment
        </Button>
        <Button
          type="button"
          variant={showEdit ? "secondary" : "ghost"}
          size="sm"
          onClick={() => {
            setShowEdit(!showEdit);
            if (!showEdit) setShowComment(false);
          }}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Activity
        </Button>
      </div>

      {/* Comment form — collapsed by default */}
      {showComment && (
        <form
          ref={commentFormRef}
          onSubmit={handleCommentSubmit}
          className="space-y-3 rounded-lg border bg-muted/20 p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Add Comment</p>
            <Select
              value={visibility}
              onValueChange={(value) =>
                setVisibility(
                  value as (typeof activityAdminCommentVisibilityValues)[number],
                )
              }
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                {activityAdminCommentVisibilityValues.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "internal"
                      ? "Internal only"
                      : "Visible to participant"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(e) => handleTextareaKeyDown(e, submitComment)}
            placeholder="Share guidance for the participant..."
            rows={2}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-muted-foreground mr-auto">
              {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter to
              send
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowComment(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              Send
            </Button>
          </div>
        </form>
      )}

      {/* Edit form — collapsed by default */}
      {showEdit && (
        <form
          ref={editFormRef}
          onSubmit={handleEditSubmit}
          className="space-y-3 rounded-lg border bg-muted/20 p-3"
        >
          <p className="text-sm font-medium">Edit Activity</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="flagged-activity-type" className="text-xs">
                Activity Type
              </Label>
              <Select value={activityTypeId} onValueChange={setActivityTypeId}>
                <SelectTrigger
                  id="flagged-activity-type"
                  className="h-8 text-sm"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes?.map(
                    (at: { _id: string; name: string }) => (
                      <SelectItem key={at._id} value={at._id}>
                        {at.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="points" className="text-xs">
                Points Earned
              </Label>
              <Input
                id="points"
                value={points}
                inputMode="decimal"
                onChange={(event) => setPoints(event.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="flagged-logged-date" className="text-xs">
                Logged Date
              </Label>
              <Input
                id="flagged-logged-date"
                type="date"
                value={loggedDate}
                onChange={(event) => setLoggedDate(event.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes" className="text-xs">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onKeyDown={(e) => handleTextareaKeyDown(e, submitEdit)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-muted-foreground mr-auto">
              {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter to
              save
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowEdit(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
});
