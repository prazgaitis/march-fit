import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaggedActivityActions } from "@/components/admin/flagged-activity-actions";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface FlaggedActivityDetailPageProps {
  params: Promise<{ id: string; activityId: string }>;
}

type HistoryEntry = {
  entry: {
    id: string;
    createdAt: number;
    actionType: string;
    payload?: {
      comment?: string;
      status?: string;
    };
  };
  actor: {
    name?: string;
    email?: string;
  };
};

export default async function FlaggedActivityDetailPage({
  params,
}: FlaggedActivityDetailPageProps) {
  const user = await requireAuth();
  const { activityId } = await params;

  const detail = await convex.query(api.queries.admin.getFlaggedActivityDetail, {
    activityId: activityId as Id<"activities">,
  });

  if (!detail) {
    notFound();
  }

  const challenge = await getChallengeOrThrow(detail.activity.challengeId as string);

  if (challenge.creatorId !== user._id && user.role !== "admin") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Flagged Activity</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Logged on {format(new Date(detail.activity.loggedDate), "PPpp")}
            </span>
            <Badge
              variant={
                detail.activity.resolutionStatus === "resolved"
                  ? "default"
                  : "outline"
              }
            >
              {detail.activity.resolutionStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Participant
            </h3>
            <p className="text-base">
              {detail.participant.name ?? "Unknown"}
              {detail.participant.email && (
                <span className="text-sm text-muted-foreground">
                  {" "}({detail.participant.email})
                </span>
              )}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Flag Reason
            </h3>
            <p className="text-base">
              {detail.activity.flaggedReason ?? "No reason provided"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Admin Comment
            </h3>
            <p className="text-base">
              {detail.activity.adminComment ?? "No admin comment recorded yet."}
            </p>
          </div>
          <FlaggedActivityActions
            activityId={detail.activity.id}
            challengeId={detail.activity.challengeId as string}
            currentStatus={detail.activity.resolutionStatus}
            currentVisibility={detail.activity.adminCommentVisibility}
            currentPoints={detail.activity.pointsEarned}
            currentNotesContent={detail.activity.notes ?? ""}
            currentActivityTypeId={detail.activity.activityTypeId as string}
            currentLoggedDate={detail.activity.loggedDate}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admin actions recorded yet.
            </p>
          ) : (
            <ol className="space-y-4">
              {detail.history.map((entry: HistoryEntry) => (
                <li key={entry.entry.id} className="border-l pl-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {entry.actor.name ?? entry.actor.email ?? "Admin"}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.entry.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entry.entry.actionType === "comment" && entry.entry.payload &&
                      `Added admin comment: ${entry.entry.payload.comment}`}
                    {entry.entry.actionType === "resolution" && entry.entry.payload &&
                      `Updated status to ${entry.entry.payload.status}`}
                    {entry.entry.actionType === "edit" &&
                      "Edited activity details"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
