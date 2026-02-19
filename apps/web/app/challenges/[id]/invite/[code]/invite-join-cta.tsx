"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface InviteJoinCtaProps {
  challengeId: string;
  inviteCode: string;
  routeChallengeId: string;
  requiresPayment: boolean;
  priceInCents: number;
  currency: string;
  isSignedIn: boolean;
}

function formatPrice(cents: number, currency: string = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function InviteJoinCta({
  challengeId,
  inviteCode,
  routeChallengeId,
  requiresPayment,
  priceInCents,
  currency,
  isSignedIn,
}: InviteJoinCtaProps) {
  const router = useRouter();
  const joinChallenge = useMutation(api.mutations.participations.join);
  const createCheckoutSession = useAction(api.actions.payments.createCheckoutSession);

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    try {
      setError(null);
      setIsJoining(true);

      if (requiresPayment) {
        const result = await createCheckoutSession({
          challengeId: challengeId as Id<"challenges">,
          successUrl: `${window.location.origin}/challenges/${challengeId}/payment-success`,
          cancelUrl: window.location.href,
        });

        if (result.url) {
          sessionStorage.setItem(`invite_code_${challengeId}`, inviteCode);
          window.location.href = result.url;
          return;
        }

        throw new Error("Failed to create checkout session");
      }

      await joinChallenge({
        challengeId: challengeId as Id<"challenges">,
        inviteCode,
      });

      router.push(`/challenges/${challengeId}/dashboard`);
    } catch (err) {
      console.error("Failed to join challenge", err);
      if (err instanceof Error) {
        if (err.message.includes("Not authenticated") || err.message.includes("User not found")) {
          router.push(`/sign-up?redirect_url=/challenges/${routeChallengeId}/invite/${inviteCode}`);
          return;
        }
        if (err.message.includes("Already joined")) {
          router.push(`/challenges/${challengeId}/dashboard`);
          return;
        }
      }
      setError("Something went wrong while joining. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const redirectUrl = `/challenges/${routeChallengeId}/invite/${inviteCode}`;

  if (!isSignedIn) {
    return (
      <div className="sticky bottom-4 z-10">
        <div className="rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link href={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}>
              Sign Up to Join
            </Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-4 z-10">
      <div className="rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
        {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}
        <Button className="w-full" size="lg" onClick={handleJoin} disabled={isJoining}>
          {isJoining ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {requiresPayment ? "Redirecting to payment..." : "Joining..."}
            </>
          ) : (
            <>
              {requiresPayment && <CreditCard className="mr-2 h-4 w-4" />}
              {requiresPayment
                ? `Join for ${formatPrice(priceInCents, currency)}`
                : "Join Challenge"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
