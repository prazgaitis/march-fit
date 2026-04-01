"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function AdminLogActivityPage() {
  const params = useParams();
  const challengeId = params.id as Id<"challenges">;

  const [userId, setUserId] = useState("");
  const [activityTypeId, setActivityTypeId] = useState("");
  const [loggedDate, setLoggedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [pointsOverride, setPointsOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    pointsEarned?: number;
    error?: string;
  } | null>(null);

  const participants = useQuery(api.queries.participations.getMentionable, {
    challengeId,
  });
  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId,
  });
  const logActivity = useMutation(api.mutations.admin.adminLogActivityForUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !activityTypeId) return;

    setSubmitting(true);
    setResult(null);
    try {
      const res = await logActivity({
        challengeId,
        userId: userId as Id<"users">,
        activityTypeId: activityTypeId as Id<"activityTypes">,
        loggedDate,
        pointsOverride: pointsOverride ? Number(pointsOverride) : undefined,
        notes: notes || undefined,
      });
      setResult({ success: true, pointsEarned: res.pointsEarned });
      // Reset form for next entry
      setPointsOverride("");
      setNotes("");
    } catch (err: any) {
      setResult({ success: false, error: err.message ?? "Failed to log activity" });
    } finally {
      setSubmitting(false);
    }
  };

  const sortedParticipants = participants
    ? [...participants].sort((a, b) =>
        (a.name ?? a.username).localeCompare(b.name ?? b.username)
      )
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">
          Log Activity
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Create an activity on behalf of a participant
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User selector */}
        <div className="space-y-1.5">
          <Label htmlFor="user" className="text-xs text-zinc-400">
            Participant
          </Label>
          {!sortedParticipants ? (
            <div className="flex h-9 items-center">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : (
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="user" className="h-9 text-sm">
                <SelectValue placeholder="Select participant..." />
              </SelectTrigger>
              <SelectContent>
                {sortedParticipants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name ?? p.username}{" "}
                    <span className="text-muted-foreground">@{p.username}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Activity type */}
        <div className="space-y-1.5">
          <Label htmlFor="activity-type" className="text-xs text-zinc-400">
            Activity Type
          </Label>
          {!activityTypes ? (
            <div className="flex h-9 items-center">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : (
            <Select value={activityTypeId} onValueChange={setActivityTypeId}>
              <SelectTrigger id="activity-type" className="h-9 text-sm">
                <SelectValue placeholder="Select activity type..." />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((at: { _id: string; name: string }) => (
                  <SelectItem key={at._id} value={at._id}>
                    {at.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="logged-date" className="text-xs text-zinc-400">
            Date
          </Label>
          <Input
            id="logged-date"
            type="date"
            value={loggedDate}
            onChange={(e) => setLoggedDate(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* Points override */}
        <div className="space-y-1.5">
          <Label htmlFor="points-override" className="text-xs text-zinc-400">
            Points Override{" "}
            <span className="text-zinc-600">(leave blank for auto-calc)</span>
          </Label>
          <Input
            id="points-override"
            inputMode="decimal"
            value={pointsOverride}
            onChange={(e) => setPointsOverride(e.target.value)}
            placeholder="Auto-calculated"
            className="h-9 text-sm"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs text-zinc-400">
            Notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-sm"
            placeholder="Optional notes..."
          />
        </div>

        {/* Result */}
        {result && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              result.success
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            )}
          >
            {result.success ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Activity logged — {result.pointsEarned} points earned
                </span>
              </>
            ) : (
              <span>{result.error}</span>
            )}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting || !userId || !activityTypeId}
          className="w-full gap-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Log Activity
        </Button>
      </form>
    </div>
  );
}
