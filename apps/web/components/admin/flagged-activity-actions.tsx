"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const STATUS_LABELS: Record<(typeof activityResolutionStatusValues)[number], string> = {
  pending: "Mark Pending",
  resolved: "Mark Resolved",
  reopened: "Reopen",
};

interface FlaggedActivityActionsProps {
  activityId: string;
  currentStatus: (typeof activityResolutionStatusValues)[number];
  currentVisibility: (typeof activityAdminCommentVisibilityValues)[number];
  currentPoints: number;
  currentNotesContent: string;
}

export function FlaggedActivityActions({
  activityId,
  currentStatus,
  currentVisibility,
  currentPoints,
  currentNotesContent,
}: FlaggedActivityActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState(currentVisibility);
  const [points, setPoints] = useState(String(currentPoints ?? 0));
  const [notes, setNotes] = useState(currentNotesContent ?? "");
  const [isPending, setIsPending] = useState(false);

  const updateResolution = useMutation(api.mutations.admin.updateFlagResolution);
  const addComment = useMutation(api.mutations.admin.addAdminComment);
  const editActivity = useMutation(api.mutations.admin.adminEditActivity);

  const handleStatusChange = async (status: (typeof activityResolutionStatusValues)[number]) => {
    setError(null);
    setMessage(null);
    setIsPending(true);

    try {
      await updateResolution({
        activityId: activityId as Id<"activities">,
        status,
      });
      setMessage(`Status updated to ${status}.`);
      router.refresh();
    } catch (err) {
      setError("Failed to update status. Please try again.");
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      setMessage("Comment added and participant notified.");
      router.refresh();
    } catch (err) {
      setError("Unable to add comment. Please try again.");
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setMessage(null);
    setIsPending(true);

    try {
      const payload: {
        activityId: Id<"activities">;
        pointsEarned?: number;
        notes?: string | null;
      } = {
        activityId: activityId as Id<"activities">,
      };

      if (points) {
        const parsedPoints = Number(points);
        if (!Number.isNaN(parsedPoints)) {
          payload.pointsEarned = parsedPoints;
        }
      }

      payload.notes = notes || null;

      await editActivity(payload);
      setMessage("Activity details updated.");
      router.refresh();
    } catch (err) {
      setError("Failed to update activity details.");
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {(message || error) && (
        <Alert variant={error ? "destructive" : "default"}>
          <AlertDescription>{error ?? message}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Resolution</h3>
        <div className="flex flex-wrap gap-2">
          {activityResolutionStatusValues.map((status) => (
            <Button
              key={status}
              type="button"
              variant={status === currentStatus ? "default" : "outline"}
              onClick={() => handleStatusChange(status)}
              disabled={isPending}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </div>
      <form onSubmit={handleCommentSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Add Admin Comment</h3>
          <Select value={visibility} onValueChange={(value) => setVisibility(value as (typeof activityAdminCommentVisibilityValues)[number])}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              {activityAdminCommentVisibilityValues.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "internal" ? "Internal" : "Participant visible"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Share guidance for the participant"
          rows={4}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            Send Comment
          </Button>
        </div>
      </form>
      <form onSubmit={handleEditSubmit} className="space-y-3">
        <h3 className="text-sm font-semibold">Adjust Activity Details</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="points">
              Points Earned
            </label>
            <Input
              id="points"
              value={points}
              inputMode="decimal"
              onChange={(event) => setPoints(event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            variant="secondary"
            disabled={isPending}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
