import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowLeft, CalendarDays, Flame, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityTypesList } from "../../activity-types/activity-types-list";
import { formatDateShortFromDateOnly } from "@/lib/date-only";
import { getToken } from "@/lib/server-auth";
import { InviteJoinCta } from "./invite-join-cta";

interface InviteAcceptPageProps {
  params: Promise<{ id: string; code: string }>;
}

interface Category {
  _id: string;
  name: string;
}

export default async function InviteAcceptPage({ params }: InviteAcceptPageProps) {
  const { id: routeChallengeId, code } = await params;
  const token = await getToken();

  const inviteData = await fetchQuery(api.queries.challengeInvites.resolveInviteCode, { code });

  if (!inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invite Link</CardTitle>
            <p className="text-sm text-muted-foreground">
              This invite link is invalid or has expired. Ask your friend for a new link.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/challenges">Browse Challenges</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const challengeId = inviteData.challengeId as Id<"challenges">;

  const [paymentInfo, activityTypes, categories, participation] = await Promise.all([
    fetchQuery(api.queries.paymentConfig.getPublicPaymentInfo, { challengeId }),
    fetchQuery(api.queries.activityTypes.getByChallengeId, { challengeId }),
    fetchQuery(api.queries.categories.getChallengeCategories, { challengeId }),
    fetchQuery(
      api.queries.participations.getCurrentUserParticipation,
      { challengeId },
      token ? { token } : {}
    ),
  ]);

  if (participation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>You&apos;re already in!</CardTitle>
            <p className="text-sm text-muted-foreground">
              You&apos;re already participating in {inviteData.challengeName}.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/challenges/${inviteData.challengeId}/dashboard`}>Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryMap = new Map<string, Category>(
    categories.map((c: Category) => [c._id, { _id: c._id, name: c.name }] as const)
  );

  const requiresPayment = paymentInfo.requiresPayment && paymentInfo.priceInCents > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Link
          href="/challenges"
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse challenges
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{inviteData.challengeName}</h1>
          {inviteData.challengeDescription && (
            <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
              {inviteData.challengeDescription}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {inviteData.inviter.name ?? inviteData.inviter.username}
            </span>{" "}
            invited you to join
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <CalendarDays className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">
              {formatDateShortFromDateOnly(inviteData.startDate)} &ndash;{" "}
              {formatDateShortFromDateOnly(inviteData.endDate)}
            </p>
            <p className="text-xs text-muted-foreground">{inviteData.durationDays} days</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <Users className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">{inviteData.participantCount}</p>
            <p className="text-xs text-muted-foreground">participants</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <Flame className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">{inviteData.streakMinPoints}+ pts</p>
            <p className="text-xs text-muted-foreground">daily for streak</p>
          </div>
        </div>

        {activityTypes.length > 0 && (
          <div className="mb-8">
            <ActivityTypesList
              activityTypes={activityTypes}
              categoryMap={categoryMap}
              streakMinPoints={inviteData.streakMinPoints}
            />
          </div>
        )}

        <InviteJoinCta
          challengeId={String(inviteData.challengeId)}
          inviteCode={code}
          routeChallengeId={routeChallengeId}
          requiresPayment={requiresPayment}
          priceInCents={paymentInfo.priceInCents}
          currency={paymentInfo.currency}
          isSignedIn={Boolean(token)}
        />
      </div>
    </div>
  );
}
