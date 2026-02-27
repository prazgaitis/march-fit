"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { usePaginatedQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UserActivitiesContentProps {
  challengeId: string;
  profileUserId: string;
}

export function UserActivitiesContent({
  challengeId,
  profileUserId,
}: UserActivitiesContentProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.queries.users.getActivities,
    {
      userId: profileUserId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
    },
    { initialNumItems: 20 }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Activities</CardTitle>
          <CardDescription>
            All logged activities for this challenge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "LoadingFirstPage" && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {status !== "LoadingFirstPage" && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activities logged yet.
            </p>
          )}

          {results.map((item) => (
            <Link
              key={item.activity._id}
              href={`/challenges/${challengeId}/activities/${item.activity._id}`}
              className="flex items-center justify-between rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">
                  {item.activityType?.name ?? "Activity"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.activity.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <p className="font-semibold text-primary">
                {item.activity.pointsEarned >= 0 ? "+" : ""}
                {item.activity.pointsEarned.toFixed(0)} pts
              </p>
            </Link>
          ))}

          {status === "CanLoadMore" && (
            <div className="pt-2 text-center">
              <Button variant="outline" onClick={() => loadMore(20)}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
