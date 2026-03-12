"use client";

import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  formatDateOnlyFromUtcMs,
  formatDateShortFromDateOnly,
  formatTimeAgo,
} from "@/lib/date-only";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  User,
} from "lucide-react";

import { RichTextViewer } from "@/components/editor/rich-text-viewer";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MediaGallery } from "@/components/media-gallery";
import { PointsDisplay } from "@/components/ui/points-display";
import { FlaggedActivityActions } from "@/components/admin/flagged-activity-actions";
import { FlaggedActivityComments } from "./flagged-activity-comments";

type FlagRecord = {
  id: string;
  reason: string;
  createdAt: number;
  resolved: boolean;
  flagger: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    username: string;
  } | null;
};

interface FlaggedActivityDetailContentProps {
  challengeId: string;
  activityId: string;
}

export function FlaggedActivityDetailContent({
  challengeId,
  activityId,
}: FlaggedActivityDetailContentProps) {
  const detail = useQuery(api.queries.admin.getFlaggedActivityDetail, {
    activityId: activityId as Id<"activities">,
  });

  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Activity not found</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link
              href={`/challenges/${challengeId}/admin/flagged-activities`}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to flagged activities
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const {
    activity,
    participant,
    activityType,
    mediaUrls,
    cloudinaryPublicIds,
    commentCount,
    flaggers,
    history,
  } = detail;

  const metrics = activity.metrics as Record<string, unknown> | undefined;
  const hasMedia =
    (mediaUrls ?? []).length > 0 ||
    (cloudinaryPublicIds && cloudinaryPublicIds.length > 0);
  const triggeredBonuses = activity.triggeredBonuses as
    | { metric: string; threshold: number; bonusPoints: number; description: string }[]
    | undefined;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/challenges/${challengeId}/admin/flagged-activities`}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Flagged Activities
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant={
              activity.resolutionStatus === "resolved"
                ? "default"
                : "destructive"
            }
          >
            {activity.resolutionStatus === "pending"
              ? "Pending Review"
              : "Resolved"}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/challenges/${challengeId}/activities/${activityId}`}
              target="_blank"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              View Activity
            </Link>
          </Button>
        </div>
      </div>

      {/* Flag Alert Banner */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-destructive">
                Flagged Activity
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activity.flaggedReason ?? "No reason provided"}
              </p>
              {activity.flaggedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Flagged{" "}
                  {formatDistanceToNow(new Date(activity.flaggedAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>

            {/* Individual flaggers */}
            {flaggers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reported by
                </p>
                {(flaggers as FlagRecord[]).map((flag) => (
                  <div
                    key={flag.id}
                    className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2"
                  >
                    {flag.flagger ? (
                      <UserAvatar
                        user={{
                          id: flag.flagger.id,
                          name: flag.flagger.name ?? null,
                          username: flag.flagger.username,
                          avatarUrl: flag.flagger.avatarUrl ?? null,
                        }}
                        size="xs"
                        disableLink
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">
                          {flag.flagger?.name ??
                            flag.flagger?.email ??
                            "Unknown user"}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(flag.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {flag.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Content Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Activity Details</CardTitle>
            <Badge variant="outline" className="text-xs capitalize">
              {activity.source}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Participant */}
          {participant && (
            <div className="flex items-center gap-3">
              <UserAvatar
                user={{
                  id: participant.id,
                  name: participant.name ?? null,
                  username: participant.username,
                  avatarUrl: participant.avatarUrl ?? null,
                }}
                challengeId={challengeId}
                size="sm"
                showName
                showUsername
              />
            </div>
          )}

          <div className="border-t" />

          {/* Activity type + points + date row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Activity Type
              </p>
              <p className="text-sm font-medium">
                {activityType?.name ?? "Unknown"}
                {activityType?.isNegative && (
                  <Badge
                    variant="destructive"
                    className="ml-2 text-[10px] px-1.5 py-0"
                  >
                    Penalty
                  </Badge>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Points
              </p>
              <PointsDisplay
                points={activity.pointsEarned}
                isNegative={activityType?.isNegative}
                decimals={2}
                size="sm"
                showSign={true}
                showLabel={true}
                className="font-mono font-semibold"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Logged Date
              </p>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateShortFromDateOnly(
                  formatDateOnlyFromUtcMs(activity.loggedDate),
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Created
              </p>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {formatTimeAgo(activity.createdAt)}
              </div>
            </div>
          </div>

          {/* Bonus breakdown */}
          {triggeredBonuses && triggeredBonuses.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {triggeredBonuses.map((bonus, i) => (
                <span key={i} className="text-amber-500">
                  +{bonus.bonusPoints}{" "}
                  {bonus.description
                    .replace(/ bonus$/i, "")
                    .toLowerCase()}
                </span>
              ))}
            </div>
          )}

          {/* Metrics */}
          {metrics && Object.keys(metrics).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Metrics
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {Object.entries(metrics).map(([key, value]) => {
                  if (
                    typeof value !== "number" &&
                    typeof value !== "string"
                  )
                    return null;
                  return (
                    <span key={key} className="text-muted-foreground">
                      <span className="font-mono font-medium text-foreground">
                        {typeof value === "number"
                          ? value.toLocaleString()
                          : String(value)}
                      </span>{" "}
                      <span className="capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Location & time context */}
          {(activity.localTime ||
            activity.locationCity ||
            activity.locationState) && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {activity.localTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activity.localTime}
                  {activity.timezone && ` (${activity.timezone})`}
                </span>
              )}
              {(activity.locationCity || activity.locationState) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[
                    activity.locationCity,
                    activity.locationState,
                    activity.locationCountry,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          {activity.notes && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Notes
              </p>
              <div className="rounded-md border bg-muted/30 p-3">
                <RichTextViewer
                  content={activity.notes}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Media */}
          {hasMedia && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Photos & Videos
              </p>
              <MediaGallery
                urls={mediaUrls ?? []}
                optimizedMediaIds={cloudinaryPublicIds}
                variant="detail"
              />
            </div>
          )}

          {/* Activity comments count */}
          {commentCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              <span>
                {commentCount} comment{commentCount !== 1 ? "s" : ""} on
                this activity
              </span>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link
                  href={`/challenges/${challengeId}/activities/${activityId}#comments`}
                  target="_blank"
                >
                  View
                </Link>
              </Button>
            </div>
          )}

          {/* External ID for strava activities */}
          {activity.externalId && (
            <p className="text-xs text-muted-foreground">
              External ID: <code className="font-mono">{activity.externalId}</code>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Admin Comments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Admin Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <FlaggedActivityComments activityId={activity.id} />
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Admin Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <FlaggedActivityActions
            activityId={activity.id}
            challengeId={activity.challengeId as string}
            currentStatus={activity.resolutionStatus}
            currentVisibility={activity.adminCommentVisibility}
            currentPoints={activity.pointsEarned}
            currentNotesContent={activity.notes ?? ""}
            currentActivityTypeId={activity.activityTypeId as string}
            currentLoggedDate={activity.loggedDate}
          />
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admin actions recorded yet.
            </p>
          ) : (
            <ol className="space-y-4">
              {history.map(
                (entry: {
                  entry: {
                    id: string;
                    createdAt: number;
                    actionType: string;
                    payload?: Record<string, unknown>;
                  };
                  actor: {
                    id?: string;
                    name?: string;
                    email?: string;
                    avatarUrl?: string;
                  } | null;
                }) => (
                  <li key={entry.entry.id} className="border-l-2 pl-4">
                    <div className="flex items-center gap-2 text-sm">
                      {entry.actor && (
                        <UserAvatar
                          user={{
                            id: entry.actor.id ?? "",
                            name: entry.actor.name ?? null,
                            username:
                              entry.actor.email ?? entry.actor.name ?? "Admin",
                            avatarUrl: entry.actor.avatarUrl ?? null,
                          }}
                          size="xs"
                          disableLink
                        />
                      )}
                      <span className="font-medium">
                        {entry.actor?.name ??
                          entry.actor?.email ??
                          "Admin"}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(
                          new Date(entry.entry.createdAt),
                          {
                            addSuffix: true,
                          },
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.entry.actionType === "flagged" &&
                        "Activity was flagged"}
                      {entry.entry.actionType === "comment" &&
                        entry.entry.payload &&
                        `Added comment: ${entry.entry.payload.comment}`}
                      {entry.entry.actionType === "resolution" &&
                        entry.entry.payload &&
                        `Updated status to ${entry.entry.payload.status}`}
                      {entry.entry.actionType === "edit" &&
                        formatEditPayload(
                          entry.entry.payload as Record<string, unknown> | undefined,
                        )}
                    </p>
                  </li>
                ),
              )}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatEditPayload(
  payload: Record<string, unknown> | undefined,
): string {
  if (!payload) return "Edited activity details";

  const changes: string[] = [];
  const changesObj = (payload.changes ?? payload) as Record<string, unknown>;

  if (changesObj.activityTypeId) changes.push("activity type");
  if (changesObj.pointsEarned !== undefined) changes.push("points");
  if (changesObj.loggedDate) changes.push("logged date");
  if (changesObj.notes !== undefined) changes.push("notes");
  if (changesObj.metrics) changes.push("metrics");

  if (changes.length === 0) return "Edited activity details";
  return `Edited ${changes.join(", ")}`;
}
