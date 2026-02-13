import Link from "next/link";
import { format } from "date-fns";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { flaggedActivitiesQuerySchema } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaggingHelpDialog } from "@/components/admin/flagging-help-dialog";

interface FlaggedActivitiesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type FlaggedActivityItem = {
  activity: {
    id: string;
    flaggedReason?: string;
    resolutionStatus: string;
    flaggedAt?: number;
  };
  participant: {
    name?: string;
    email?: string;
  };
  activityType?: {
    name: string;
  };
};

export default async function FlaggedActivitiesPage({
  params,
  searchParams,
}: FlaggedActivitiesPageProps) {
  const convex = getConvexClient();
  const user = await requireAuth();
  const { id } = await params;
  const searchParamsResolved = await searchParams;
  const challenge = await getChallengeOrThrow(id);

  if (challenge.creatorId !== user._id && user.role !== "admin") {
    return null;
  }

  const raw = Object.fromEntries(
    Object.entries(searchParamsResolved)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string]),
  );

  const parsed = flaggedActivitiesQuerySchema.parse(raw);
  const page = parsed.page ?? 1;
  const limit = parsed.limit ?? 50;

  const result = await convex.query(api.queries.admin.listFlaggedActivities, {
    challengeId: challenge.id as Id<"challenges">,
    status: parsed.status as "pending" | "resolved" | undefined,
    participantId: parsed.participantId as Id<"users"> | undefined,
    search: parsed.search,
    limit,
    offset: (page - 1) * limit,
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <CardTitle>Flagged Activities</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review activities that have been flagged for follow-up.
            </p>
          </div>
          <FlaggingHelpDialog />
        </div>
        <form className="flex items-center gap-2" action="" method="get">
          <Input
            name="search"
            placeholder="Search participant or reason"
            defaultValue={parsed.search ?? ""}
            className="w-56"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Participant</th>
              <th className="px-4 py-2">Activity Type</th>
              <th className="px-4 py-2">Flag Reason</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Flagged</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                  No flagged activities found.
                </td>
              </tr>
            ) : (
              result.items.map((item: FlaggedActivityItem) => (
                <tr key={item.activity.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {item.participant.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.participant.email ?? ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.activityType?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.activity.flaggedReason ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        item.activity.resolutionStatus === "resolved"
                          ? "default"
                          : "outline"
                      }
                    >
                      {item.activity.resolutionStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {item.activity.flaggedAt
                      ? format(new Date(item.activity.flaggedAt), "PP p")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/challenges/${challenge.id}/admin/flagged-activities/${item.activity.id}`}
                      >
                        View Details
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {result.total > limit && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {(page - 1) * limit + 1} -
              {Math.min(page * limit, result.total)} of {result.total}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={`/challenges/${challenge.id}/admin/flagged-activities?${new URLSearchParams({
                      ...raw,
                      page: String(page - 1),
                    }).toString()}`}
                  >
                    Previous
                  </Link>
                </Button>
              )}
              {page * limit < result.total && (
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={`/challenges/${challenge.id}/admin/flagged-activities?${new URLSearchParams({
                      ...raw,
                      page: String(page + 1),
                    }).toString()}`}
                  >
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
