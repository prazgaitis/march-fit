"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2, Users, CreditCard } from "lucide-react";
import { formatDateShortFromDateOnly } from "@/lib/date-only";

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
          // Store invite code so we can use it after payment
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
      <div className="flex min-h-screen items-center justify-center page-with-header">
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
      <div className="flex min-h-screen items-center justify-center page-with-header">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invite Link</CardTitle>
            <CardDescription>
              This invite link is invalid or has expired. Ask your friend for a
              new link.
            </CardDescription>
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
      <div className="flex min-h-screen items-center justify-center page-with-header">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>You&apos;re already in!</CardTitle>
            <CardDescription>
              You&apos;re already participating in {inviteData.challengeName}.
            </CardDescription>
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
    <div className="flex min-h-screen items-center justify-center p-4 page-with-header">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{inviteData.challengeName}</CardTitle>
          {inviteData.challengeDescription && (
            <CardDescription className="text-base">
              {inviteData.challengeDescription}
            </CardDescription>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-medium text-foreground">
              {inviteData.inviter.name ?? inviteData.inviter.username}
            </span>{" "}
            invited you to join this challenge
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>
                {formatDateShortFromDateOnly(inviteData.startDate)} &ndash;{" "}
                {formatDateShortFromDateOnly(inviteData.endDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{inviteData.participantCount} participants</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
