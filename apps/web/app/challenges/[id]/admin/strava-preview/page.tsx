import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { requireAuth } from "@/lib/auth";
import { getChallengeOrThrow } from "@/lib/challenge-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StravaPreviewClient } from "./strava-preview-client";

interface StravaPreviewPageProps {
  params: Promise<{ id: string }>;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function StravaPreviewPage({
  params,
}: StravaPreviewPageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const challenge = await getChallengeOrThrow(id);

  if (challenge.creatorId !== user._id && user.role !== "admin") {
    return null;
  }

  // Get participants with Strava connected
  const participantsWithStrava = await convex.query(
    api.queries.integrations.getChallengeParticipantsWithStrava,
    { challengeId: challenge.id as Id<"challenges"> }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strava Activity Preview</CardTitle>
        <CardDescription>
          Select a participant with Strava connected to preview their recent activities
          and see how they would be scored according to your activity type configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StravaPreviewClient
          challengeId={challenge.id}
          participantsWithStrava={participantsWithStrava}
        />
      </CardContent>
    </Card>
  );
}
