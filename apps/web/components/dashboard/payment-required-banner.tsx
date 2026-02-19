"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaymentRequiredBannerProps {
  challengeId: string;
}

export function PaymentRequiredBanner({ challengeId }: PaymentRequiredBannerProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const paymentInfo = useQuery(api.queries.paymentConfig.getPublicPaymentInfo, {
    challengeId: challengeId as Id<"challenges">,
  });

  const participation = useQuery(
    api.queries.participations.getCurrentUserParticipation,
    {
      challengeId: challengeId as Id<"challenges">,
    }
  );

  const createCheckoutSession = useAction(api.actions.payments.createCheckoutSession);

  const requiresPayment = Boolean(
    paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0
  );

  const needsPayment =
    requiresPayment &&
    participation &&
    participation.paymentStatus !== "paid";

  if (!needsPayment) {
    return null;
  }

  const formatPrice = (cents: number, currency: string = "usd") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);

  const priceLabel = paymentInfo
    ? formatPrice(paymentInfo.priceInCents, paymentInfo.currency)
    : "";

  const statusLabel = participation?.paymentStatus === "pending"
    ? "Payment pending"
    : participation?.paymentStatus === "failed"
      ? "Payment failed"
      : "Payment required";

  const handleCompletePayment = async () => {
    if (!paymentInfo) return;
    setErrorMessage(null);
    setIsRedirecting(true);

    try {
      const result = await createCheckoutSession({
        challengeId: challengeId as Id<"challenges">,
        successUrl: `${window.location.origin}/challenges/${challengeId}/payment-success`,
        cancelUrl: `${window.location.origin}/challenges/${challengeId}/dashboard`,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment failed");
      setIsRedirecting(false);
    }
  };

  return (
    <div className="px-4 pt-4">
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100",
          "sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-500/20 p-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <div className="text-sm font-semibold">{statusLabel}</div>
            <div className="text-xs text-amber-100/80">
              Complete your {priceLabel} payment to log activities in this challenge.
            </div>
            {errorMessage ? (
              <div className="mt-2 text-xs text-red-200">{errorMessage}</div>
            ) : null}
          </div>
        </div>
        <Button
          onClick={handleCompletePayment}
          disabled={isRedirecting}
          className="w-full bg-amber-400 text-black hover:bg-amber-300 sm:w-auto"
        >
          {isRedirecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Complete payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
