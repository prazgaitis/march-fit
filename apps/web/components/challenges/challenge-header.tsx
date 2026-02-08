"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Trophy, CreditCard, Loader2, CheckCircle, XCircle, Lock } from "lucide-react";
import { dateOnlyToUtcMs, formatDateShortFromDateOnly } from "@/lib/date-only";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  streakMinPoints: number;
  participantCount: number;
  visibility?: "public" | "private";
}

interface ChallengeHeaderProps {
  challenge: Challenge;
  isParticipating: boolean;
  isSignedIn: boolean;
}

export function ChallengeHeader({ challenge, isParticipating, isSignedIn }: ChallengeHeaderProps) {
  const router = useRouter();
  const [participating, setParticipating] = useState(isParticipating);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const joinChallenge = useMutation(api.mutations.participations.join);
  const createCheckoutSession = useMutation(api.mutations.payments.createCheckoutSession);

  // Get payment info for this challenge
  const paymentInfo = useQuery(api.queries.paymentConfig.getPublicPaymentInfo, {
    challengeId: challenge.id as Id<"challenges">,
  });

  const participation = useQuery(
    api.queries.participations.getCurrentUserParticipation,
    isSignedIn ? { challengeId: challenge.id as Id<"challenges"> } : "skip"
  );

  const startDateMs = dateOnlyToUtcMs(challenge.startDate);
  const endDateMs = dateOnlyToUtcMs(challenge.endDate);
  const nowMs = Date.now();

  const isUpcoming = nowMs < startDateMs;
  const isActive = nowMs >= startDateMs && nowMs <= endDateMs;
  const isEnded = nowMs > endDateMs;

  const formatPrice = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handleJoin = async () => {
    try {
      setJoinError(null);
      setIsJoining(true);

      // Check if payment is required
      if (paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0) {
        // Create Stripe Checkout session and redirect
        const result = await createCheckoutSession({
          challengeId: challenge.id as Id<"challenges">,
          successUrl: `${window.location.origin}/challenges/${challenge.id}/payment-success`,
          cancelUrl: `${window.location.origin}/challenges/${challenge.id}`,
        });

        if (result.url) {
          window.location.href = result.url;
        } else {
          throw new Error("Failed to create checkout session");
        }
        return;
      }

      // Free challenge - join directly
      await joinChallenge({
        challengeId: challenge.id as Id<"challenges">,
      });

      setParticipating(true);
      router.push(`/challenges/${challenge.id}/dashboard`);
    } catch (error) {
      console.error("Failed to join challenge", error);

      // Handle specific error messages
      if (error instanceof Error) {
        if (error.message.includes("Not authenticated") || error.message.includes("User not found")) {
          router.push(`/sign-in?redirect_url=/challenges/${challenge.id}`);
          return;
        }
        if (error.message.includes("Already joined")) {
          setJoinError("You've already joined this challenge.");
          setParticipating(true);
          return;
        }
        if (error.message.includes("Already paid")) {
          setParticipating(true);
          router.push(`/challenges/${challenge.id}/dashboard`);
          return;
        }
      }

      setJoinError("Something went wrong while joining.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCompletePayment = async () => {
    try {
      setJoinError(null);
      setIsJoining(true);

      const result = await createCheckoutSession({
        challengeId: challenge.id as Id<"challenges">,
        successUrl: `${window.location.origin}/challenges/${challenge.id}/payment-success`,
        cancelUrl: `${window.location.origin}/challenges/${challenge.id}`,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Failed to start payment", error);
      setJoinError("Unable to start payment. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const getStatusBadge = () => {
    if (isUpcoming) return <Badge variant="secondary">Upcoming</Badge>;
    if (isActive) return <Badge variant="default">Active</Badge>;
    if (isEnded) return <Badge variant="outline">Ended</Badge>;
    return null;
  };

  const getJoinButton = () => {
    if (!isSignedIn) {
      return (
        <Button asChild>
          <Link href="/sign-up">Sign Up to Join</Link>
        </Button>
      );
    }

    const requiresPayment = paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0;
    const needsPayment =
      requiresPayment && participation && participation.paymentStatus !== "paid";
    const priceLabel = requiresPayment
      ? formatPrice(paymentInfo.priceInCents, paymentInfo.currency)
      : null;

    if (participating) {
      if (needsPayment) {
        return (
          <Button onClick={handleCompletePayment} disabled={isJoining}>
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to payment...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Complete payment {priceLabel ? `(${priceLabel})` : ""}
              </>
            )}
          </Button>
        );
      }
      return (
        <Button asChild>
          <Link href={`/challenges/${challenge.id}/dashboard`}>Go to Dashboard</Link>
        </Button>
      );
    }

    if (isEnded) {
      return (
        <Button disabled variant="outline">
          Challenge Ended
        </Button>
      );
    }

    if (challenge.visibility === "private") {
      return (
        <Button disabled variant="outline">
          <Lock className="mr-2 h-4 w-4" />
          Invitation Required
        </Button>
      );
    }

    return (
      <Button onClick={handleJoin} disabled={isJoining}>
        {isJoining ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {requiresPayment ? "Redirecting to payment..." : "Joining..."}
          </>
        ) : (
          <>
            {requiresPayment && <CreditCard className="mr-2 h-4 w-4" />}
            {requiresPayment ? `Join for ${priceLabel}` : "Join Challenge"}
          </>
        )}
      </Button>
    );
  };

  return (
    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{challenge.name}</h1>
              <p className="text-xl text-primary-foreground/90 mb-6 max-w-2xl">{challenge.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                {isSignedIn && (
                  participating ? (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-100 border-green-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {isEnded ? "Participated" : "Participating"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30">
                      <XCircle className="h-3 w-3 mr-1" />
                      {isEnded ? "Did not participate" : "Not participating"}
                    </Badge>
                  )
                )}
              </div>
              {getJoinButton()}
            </div>
          </div>

          {joinError && (
            <Alert variant="destructive" className="bg-destructive/20 text-destructive-foreground border-destructive/30">
              <AlertTitle>Unable to join</AlertTitle>
              <AlertDescription className="text-destructive-foreground/90">
                {joinError}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <CalendarDays className="h-8 w-8 text-primary-foreground/80" />
              <div>
                <p className="text-sm text-primary-foreground/80">Duration</p>
                <p className="text-lg font-semibold">
                  {formatDateShortFromDateOnly(challenge.startDate)} - {formatDateShortFromDateOnly(challenge.endDate)}
                </p>
                <p className="text-sm text-primary-foreground/80">{challenge.durationDays} days</p>
              </div>
            </div>

            <Link
              href={`/challenges/${challenge.id}/leaderboard`}
              className="flex items-center space-x-3 rounded-lg p-2 transition hover:bg-white/10"
            >
              <Users className="h-8 w-8 text-primary-foreground/80" />
              <div>
                <p className="text-sm text-primary-foreground/80">Participants</p>
                <p className="text-lg font-semibold">{challenge.participantCount}</p>
                <p className="text-sm text-primary-foreground/80">View all</p>
              </div>
            </Link>

            <div className="flex items-center space-x-3">
              <Trophy className="h-8 w-8 text-primary-foreground/80" />
              <div>
                <p className="text-sm text-primary-foreground/80">Streak Goal</p>
                <p className="text-lg font-semibold">{challenge.streakMinPoints} points/day</p>
                <p className="text-sm text-primary-foreground/80">minimum</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
