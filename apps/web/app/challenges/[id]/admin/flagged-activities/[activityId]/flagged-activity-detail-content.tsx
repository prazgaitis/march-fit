"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@/lib/convex-auth-react";
import { useRouter } from "next/navigation";
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
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  User,
} from "lucide-react";

import { RichTextViewer } from "@/components/editor/rich-text-viewer";
import { UserAvatar } from "@/components/user-avatar";
import { UserChallengeDisplay } from "@/components/user-challenge-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/media-gallery";
import { PointsDisplay } from "@/components/ui/points-display";
import {
  FlaggedActivityActions,
  type FlaggedActivityActionsHandle,
} from "@/components/admin/flagged-activity-actions";
import { FlaggedActivityComments } from "./flagged-activity-comments";
import { useFlaggedList } from "../flagged-list-context";

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
  const actionsRef = useRef<FlaggedActivityActionsHandle>(null);
  const router = useRouter();

  const detail = useQuery(api.queries.admin.getFlaggedActivityDetail, {
    activityId: activityId as Id<"activities">,
  });

  // Use the sidebar's visible items for arrow key navigation
  const { items: sidebarItems } = useFlaggedList();

  const navigateToSibling = useCallback(
    (direction: "prev" | "next") => {
      if (sidebarItems.length === 0) return;
      const currentIndex = sidebarItems.findIndex(
        (item) => item.activity.id === activityId,
      );
      // If current item left the filtered list (e.g. resolved while filtering pending),
      // navigate to the first item in the list
      if (currentIndex === -1) {
        const fallback = sidebarItems[0];
        if (fallback) {
          router.push(
            `/challenges/${challengeId}/admin/flagged-activities/${fallback.activity.id}`,
          );
        }
        return;
      }
      const targetIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sidebarItems.length) return;
      const target = sidebarItems[targetIndex];
      router.push(
        `/challenges/${challengeId}/admin/flagged-activities/${target.activity.id}`,
      );
    },
    [sidebarItems, activityId, challengeId, router],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ESC always works — closes open forms even when focused in an input
      if (e.key === "Escape") {
        const closed = actionsRef.current?.closeOpen();
        if (closed) {
          e.preventDefault();
          // Return focus to the page so other shortcuts work immediately
          (e.target as HTMLElement).blur?.();
        }
        return;
      }

      // Don't fire when typing in inputs/textareas/selects
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Don't fire with modifier keys (except for specific combos)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          navigateToSibling("prev");
          break;
        case "ArrowRight":
        case "k":
          e.preventDefault();
          navigateToSibling("next");
          break;
        case "r":
          e.preventDefault();
          actionsRef.current?.resolve();
          break;
        case "c":
          e.preventDefault();
          actionsRef.current?.toggleComment();
          break;
        case "e":
          e.preventDefault();
          actionsRef.current?.toggleEdit();
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigateToSibling]);

  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-medium text-zinc-400">Activity not found</p>
        <p className="mt-1 text-xs text-zinc-600">
          It may have been deleted.
        </p>
      </div>
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
    <div className="mx-auto max-w-2xl">
      {/* Flag banner — compact */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-destructive">
                Flagged
              </p>
              <Badge
                variant={
                  activity.resolutionStatus === "resolved"
                    ? "default"
                    : "destructive"
                }
                className="text-[9px] px-1.5 py-0 h-4"
              >
                {activity.resolutionStatus === "pending"
                  ? "Pending"
                  : "Resolved"}
              </Badge>
              {activity.flaggedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.flaggedAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[10px]" asChild>
                <Link
                  href={`/challenges/${challengeId}/activities/${activityId}`}
                  target="_blank"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Open
                </Link>
              </Button>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {activity.flaggedReason ?? "No reason provided"}
            </p>
            {/* Flagger chips */}
            {flaggers.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">by</span>
                {(flaggers as FlagRecord[]).map((flag) => (
                  <span
                    key={flag.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/50 px-1.5 py-0.5 text-[10px]"
                    title={flag.reason}
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
                      <User className="h-3 w-3 text-muted-foreground" />
                    )}
                    {flag.flagger?.name ?? flag.flagger?.email ?? "Unknown"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="border-b border-zinc-800 px-1 py-3">
        <FlaggedActivityActions
          ref={actionsRef}
          activityId={activity.id}
          challengeId={activity.challengeId as string}
          currentStatus={activity.resolutionStatus}
          currentVisibility={activity.adminCommentVisibility}
          currentPoints={activity.pointsEarned}
          currentNotesContent={activity.notes ?? ""}
          currentActivityTypeId={activity.activityTypeId as string}
          currentLoggedDate={activity.loggedDate}
        />
      </div>

      {/* ---- Activity content (mirrors activity detail page) ---- */}

      {/* User header */}
      {participant && (
        <div className="px-4 py-2">
          <UserChallengeDisplay
            user={{
              id: participant.id,
              name: participant.name ?? null,
              username: participant.username,
              avatarUrl: participant.avatarUrl ?? null,
            }}
            challengeId={challengeId}
            size="sm"
            layout="inline"
            show={{ name: true, username: true }}
            suffix={
              <>
                <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTimeAgo(activity.createdAt)}
                </span>
              </>
            }
          >
            <span className="text-xs text-muted-foreground">
              {activityType?.name ?? "Unknown"}
              {activityType?.isNegative && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">Penalty</Badge>
              )}
            </span>
          </UserChallengeDisplay>
        </div>
      )}

      {/* Notes (no media) */}
      {!hasMedia && activity.notes && (
        <div className="px-4 pb-2">
          <RichTextViewer content={activity.notes} className="text-sm" />
        </div>
      )}

      {/* Media */}
      {hasMedia && (
        <MediaGallery
          urls={mediaUrls ?? []}
          optimizedMediaIds={cloudinaryPublicIds}
          variant="detail"
        />
      )}

      {/* Stats */}
      <div className="space-y-2 px-4 pt-2">
        {/* Points + date row */}
        <div className="flex items-center gap-3 text-sm">
          <PointsDisplay
            points={activity.pointsEarned}
            isNegative={activityType?.isNegative}
            decimals={2}
            size="sm"
            showSign={true}
            showLabel={true}
            className="font-mono font-semibold"
          />
          <span className="text-xs text-muted-foreground">
            {formatDateShortFromDateOnly(
              formatDateOnlyFromUtcMs(activity.loggedDate),
            )}
          </span>
          {activity.source !== "manual" && (
            <span className="text-xs text-muted-foreground">
              via <span className="capitalize">{activity.source}</span>
            </span>
          )}
          {activity.externalId && (
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              {activity.externalId}
            </span>
          )}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {Object.entries(metrics).map(([key, value]) => {
              if (typeof value !== "number" && typeof value !== "string")
                return null;
              return (
                <span key={key} className="text-muted-foreground">
                  <span className="font-mono font-medium text-foreground">
                    {typeof value === "number"
                      ? value.toLocaleString()
                      : String(value)}
                  </span>{" "}
                  <span className="capitalize">{key.replace(/_/g, " ")}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Location & time context */}
      {(activity.localTime ||
        activity.locationCity ||
        activity.locationState) && (
        <div className="flex flex-wrap items-center gap-3 px-4 pt-1 text-xs text-muted-foreground">
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

      {/* Caption (IG-style: username + notes, below media) */}
      {hasMedia && activity.notes && (
        <div className="px-4 pt-1 text-sm leading-snug">
          <span className="font-semibold text-foreground">
            {participant?.username}
          </span>{" "}
          <RichTextViewer
            content={activity.notes}
            className="inline text-sm text-muted-foreground [&_p]:inline"
          />
        </div>
      )}

      {/* Activity comments count */}
      {commentCount > 0 && (
        <div className="flex items-center gap-2 px-4 pt-2 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span>
            {commentCount} comment{commentCount !== 1 ? "s" : ""}
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

      {/* ---- Admin sections ---- */}

      {/* Admin Comments */}
      <div className="border-t border-zinc-800 mt-4 px-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Admin Comments
        </p>
        <FlaggedActivityComments activityId={activity.id} />
      </div>

      {/* History */}
      <div className="border-t border-zinc-800 mt-4 px-4 pt-3 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          History
          {history.length > 0 && (
            <span className="font-normal ml-1">({history.length})</span>
          )}
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No admin actions recorded yet.
          </p>
        ) : (
          <ol className="space-y-3">
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
                <li
                  key={entry.entry.id}
                  className={`border-l-2 pl-3 ${historyBorderColor(entry.entry.actionType)}`}
                >
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
                  <p className="mt-0.5 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}

function historyBorderColor(actionType: string): string {
  switch (actionType) {
    case "flagged":
      return "border-destructive/60";
    case "resolution":
      return "border-green-500/60";
    case "comment":
      return "border-blue-500/60";
    case "edit":
      return "border-amber-500/60";
    default:
      return "border-border";
  }
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
