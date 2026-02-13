"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id, Doc } from "@repo/backend/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Trophy,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  Lock,
  Settings,
} from "lucide-react";
import { dateOnlyToUtcMs, formatDateShortFromDateOnly } from "@/lib/date-only";
import { ChallengeDetails } from "@/components/challenges/challenge-details";
import { ParticipantsList } from "@/components/challenges/participants-list";
import { InviteCard } from "@/components/dashboard/invite-card";

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
  welcomeVideoUrl?: string;
  welcomeMessage?: string;
}

interface Participant {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

interface ChallengePageContentProps {
  challenge: Challenge;
  isParticipating: boolean;
  isSignedIn: boolean;
  participants: Participant[];
  activityTypes: Doc<"activityTypes">[];
}

type Tab = "details" | "participants";

export function ChallengePageContent({
  challenge,
  isParticipating: initialIsParticipating,
  isSignedIn,
  participants,
  activityTypes,
}: ChallengePageContentProps) {
  const router = useRouter();
  const [participating, setParticipating] = useState(initialIsParticipating);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  const joinChallenge = useMutation(api.mutations.participations.join);
  const createCheckoutSession = useMutation(api.mutations.payments.createCheckoutSession);

  const paymentInfo = useQuery(api.queries.paymentConfig.getPublicPaymentInfo, {
    challengeId: challenge.id as Id<"challenges">,
  });

  const participation = useQuery(
    api.queries.participations.getCurrentUserParticipation,
    isSignedIn ? { challengeId: challenge.id as Id<"challenges"> } : "skip"
  );

  const adminInfo = useQuery(
    api.queries.participations.isUserChallengeAdmin,
    isSignedIn ? { challengeId: challenge.id as Id<"challenges"> } : "skip"
  );

  const isAdmin = adminInfo?.isAdmin ?? false;

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

      if (paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0) {
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

      await joinChallenge({
        challengeId: challenge.id as Id<"challenges">,
      });

      setParticipating(true);
      router.push(`/challenges/${challenge.id}/dashboard`);
    } catch (error) {
      console.error("Failed to join challenge", error);

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

  const requiresPayment = paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0;
  const needsPayment =
    requiresPayment && participation && participation.paymentStatus !== "paid";
  const priceLabel = requiresPayment
    ? formatPrice(paymentInfo.priceInCents, paymentInfo.currency)
    : null;

  const getActionButton = (fullWidth = false) => {
    const cls = fullWidth ? "w-full" : "";

    if (!isSignedIn) {
      const redirectUrl = encodeURIComponent(`/challenges/${challenge.id}`);
      return (
        <div className={cls}>
          <Button asChild className="w-full">
            <Link href={`/sign-up?redirect_url=${redirectUrl}`}>Sign Up to Join</Link>
          </Button>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/sign-in?redirect_url=${redirectUrl}`} className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              Sign in
            </Link>
          </p>
        </div>
      );
    }

    if (participating) {
      if (needsPayment) {
        return (
          <Button onClick={handleCompletePayment} disabled={isJoining} className={cls}>
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
        <Button asChild className={cls}>
          <Link href={`/challenges/${challenge.id}/dashboard`}>Go to Dashboard</Link>
        </Button>
      );
    }

    if (isEnded) {
      return (
        <Button disabled variant="outline" className={cls}>
          Challenge Ended
        </Button>
      );
    }

    if (challenge.visibility === "private") {
      return (
        <Button disabled variant="outline" className={cls}>
          <Lock className="mr-2 h-4 w-4" />
          Invitation Required
        </Button>
      );
    }

    return (
      <Button onClick={handleJoin} disabled={isJoining} className={cls}>
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
    <div className="min-h-screen bg-background text-foreground pb-24 lg:pb-8">
      {/* Header */}
      <div className="container mx-auto px-4 pt-6 pb-4">
        <div className="mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/challenges">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-3">{challenge.name}</h1>

        <div className="flex flex-wrap items-center gap-2 mb-4">
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

        {challenge.description && (
          <p className="text-muted-foreground mb-6 max-w-2xl">{challenge.description}</p>
        )}

        {joinError && (
          <Alert variant="destructive" className="mb-6 bg-destructive/20 text-destructive-foreground border-destructive/30">
            <AlertTitle>Unable to join</AlertTitle>
            <AlertDescription className="text-destructive-foreground/90">
              {joinError}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-3 overflow-x-auto lg:flex-wrap pb-2">
          <div className="flex items-center gap-2 rounded-full bg-zinc-800/50 px-4 py-2 text-sm whitespace-nowrap">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span>
              {formatDateShortFromDateOnly(challenge.startDate)} – {formatDateShortFromDateOnly(challenge.endDate)}
            </span>
            <span className="text-muted-foreground">({challenge.durationDays}d)</span>
          </div>

          <Link
            href={`/challenges/${challenge.id}/leaderboard`}
            className="flex items-center gap-2 rounded-full bg-zinc-800/50 px-4 py-2 text-sm whitespace-nowrap hover:bg-zinc-700/50 transition-colors"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{challenge.participantCount} participants</span>
          </Link>

          <div className="flex items-center gap-2 rounded-full bg-zinc-800/50 px-4 py-2 text-sm whitespace-nowrap">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span>{challenge.streakMinPoints} pts/day streak</span>
          </div>

          {/* Desktop inline buttons */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            {getActionButton()}
            {isAdmin && (
              <Button variant="outline" asChild>
                <Link href={`/challenges/${challenge.id}/admin`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab switcher (mobile only) */}
      <div className="container mx-auto px-4 lg:hidden">
        <div className="mb-6 flex rounded-lg bg-zinc-900/50 p-1">
          <button
            onClick={() => setActiveTab("details")}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition",
              activeTab === "details"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-300"
            )}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("participants")}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition",
              activeTab === "participants"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-300"
            )}
          >
            Participants
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="container mx-auto px-4">
        {/* Mobile: tab-switched */}
        <div className="lg:hidden">
          {activeTab === "details" ? (
            <div className="space-y-6">
              {participating && <InviteCard challengeId={challenge.id} />}
              <ChallengeDetails
                challenge={challenge}
                activityTypes={activityTypes}
              />
            </div>
          ) : (
            <ParticipantsList
              challengeId={challenge.id}
              totalCount={challenge.participantCount}
              participants={participants}
            />
          )}
        </div>

        {/* Desktop: side-by-side grid */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {participating && <InviteCard challengeId={challenge.id} />}
            <ChallengeDetails
              challenge={challenge}
              activityTypes={activityTypes}
            />
          </div>
          <div className="lg:col-span-1">
            <ParticipantsList
              challengeId={challenge.id}
              totalCount={challenge.participantCount}
              participants={participants}
            />
          </div>
        </div>
      </div>

      {/* Sticky bottom bar (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur p-4 lg:hidden">
        <div className={cn("flex gap-2", isAdmin ? "flex-col sm:flex-row" : "")}>
          {getActionButton(true)}
          {isAdmin && (
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/challenges/${challenge.id}/admin`}>
                <Settings className="mr-2 h-4 w-4" />
                Admin Panel
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
