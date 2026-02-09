"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarDays,
  Loader2,
  Users,
  CreditCard,
  Flame,
  ArrowLeft,
} from "lucide-react";
import { formatDateShortFromDateOnly } from "@/lib/date-only";
import { ActivityTypesList } from "../../activity-types/activity-types-list";

export default function InviteAcceptPage() {
  const params = useParams<{ id: string; code: string }>();
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteData = useQuery(api.queries.challengeInvites.resolveInviteCode, {
    code: params.code,
  });

  const participation = useQuery(
    api.queries.participations.getCurrentUserParticipation,
    inviteData ? { challengeId: inviteData.challengeId } : "skip"
  );

  const paymentInfo = useQuery(
    api.queries.paymentConfig.getPublicPaymentInfo,
    inviteData
      ? { challengeId: inviteData.challengeId }
      : "skip"
  );

  const activityTypes = useQuery(
    api.queries.activityTypes.getByChallengeId,
    inviteData ? { challengeId: inviteData.challengeId } : "skip"
  );

  const categories = useQuery(
    api.queries.categories.getChallengeCategories,
    inviteData ? { challengeId: inviteData.challengeId } : "skip"
  );

  const categoryMap = useMemo(() => {
    if (!categories) return new Map<string, { _id: string; name: string }>();
    return new Map<string, { _id: string; name: string }>(
      categories.map((c: { _id: string; name: string }) => [c._id, { _id: c._id, name: c.name }] as const)
    );
  }, [categories]);

  const joinChallenge = useMutation(api.mutations.participations.join);
  const createCheckoutSession = useMutation(api.mutations.payments.createCheckoutSession);

  const handleJoin = async () => {
    if (!inviteData) return;

    try {
      setError(null);
      setIsJoining(true);

      const requiresPayment =
        paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0;

      if (requiresPayment) {
        const result = await createCheckoutSession({
          challengeId: inviteData.challengeId,
          successUrl: `${window.location.origin}/challenges/${inviteData.challengeId}/payment-success`,
          cancelUrl: window.location.href,
        });

        if (result.url) {
          sessionStorage.setItem(
            `invite_code_${inviteData.challengeId}`,
            params.code
          );
          window.location.href = result.url;
        } else {
          throw new Error("Failed to create checkout session");
        }
        return;
      }

      await joinChallenge({
        challengeId: inviteData.challengeId,
        inviteCode: params.code,
      });

      router.push(`/challenges/${inviteData.challengeId}/dashboard`);
    } catch (err) {
      console.error("Failed to join challenge", err);
      if (err instanceof Error) {
        if (
          err.message.includes("Not authenticated") ||
          err.message.includes("User not found")
        ) {
          router.push(
            `/sign-up?redirect_url=/challenges/${params.id}/invite/${params.code}`
          );
          return;
        }
        if (err.message.includes("Already joined")) {
          router.push(`/challenges/${inviteData!.challengeId}/dashboard`);
          return;
        }
      }
      setError("Something went wrong while joining. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  // Loading state
  if (inviteData === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading invite...
        </div>
      </div>
    );
  }

  // Invalid invite code
  if (inviteData === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invite Link</CardTitle>
            <p className="text-sm text-muted-foreground">
              This invite link is invalid or has expired. Ask your friend for a
              new link.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/challenges")}>
              Browse Challenges
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already participating
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
            <Button
              onClick={() =>
                router.push(
                  `/challenges/${inviteData.challengeId}/dashboard`
                )
              }
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requiresPayment =
    paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0;

  const formatPrice = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Back link */}
        <button
          onClick={() => router.push("/challenges")}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse challenges
        </button>

        {/* Hero section */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {inviteData.challengeName}
          </h1>
          {inviteData.challengeDescription && (
            <p className="mt-3 text-base text-muted-foreground max-w-lg mx-auto">
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

        {/* Stats row */}
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

        {/* Activity types & scoring - reuse the shared component */}
        {activityTypes && activityTypes.length > 0 && (
          <div className="mb-8">
            <ActivityTypesList
              activityTypes={activityTypes}
              categoryMap={categoryMap}
              streakMinPoints={inviteData.streakMinPoints}
            />
          </div>
        )}

        {/* Join CTA */}
        <div className="sticky bottom-4 z-10">
          <div className="rounded-xl border bg-card/95 backdrop-blur p-4 shadow-lg">
            {error && (
              <p className="mb-3 text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={handleJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {requiresPayment
                    ? "Redirecting to payment..."
                    : "Joining..."}
                </>
              ) : (
                <>
                  {requiresPayment && <CreditCard className="mr-2 h-4 w-4" />}
                  {requiresPayment
                    ? `Join for ${formatPrice(paymentInfo!.priceInCents, paymentInfo!.currency)}`
                    : "Join Challenge"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
