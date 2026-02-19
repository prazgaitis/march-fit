"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PaymentSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const challengeId = params.id as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifyCheckoutSession = useAction(api.actions.payments.verifyCheckoutSession);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setErrorMessage("No payment session found");
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyCheckoutSession({
          challengeId: challengeId as Id<"challenges">,
          sessionId,
        });

        if (result.success) {
          setStatus("success");
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push(`/challenges/${challengeId}/dashboard`);
          }, 2000);
        } else {
          setStatus("error");
          setErrorMessage("Payment verification failed. Please contact support.");
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Payment verification failed"
        );
      }
    };

    verify();
  }, [sessionId, challengeId, verifyCheckoutSession, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="mx-auto max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="mx-auto h-16 w-16 animate-spin text-amber-400" />
            <h1 className="mt-6 text-2xl font-bold text-white">
              Verifying your payment...
            </h1>
            <p className="mt-2 text-zinc-400">
              Please wait while we confirm your payment.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
            <h1 className="mt-6 text-2xl font-bold text-white">
              Payment Successful!
            </h1>
            <p className="mt-2 text-zinc-400">
              You have successfully joined the challenge. Redirecting to your dashboard...
            </p>
            <Button asChild className="mt-6 bg-amber-500 text-black hover:bg-amber-400">
              <Link href={`/challenges/${challengeId}/dashboard`}>
                Go to Dashboard
              </Link>
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-400" />
            <h1 className="mt-6 text-2xl font-bold text-white">
              Payment Issue
            </h1>
            <p className="mt-2 text-zinc-400">
              {errorMessage || "There was an issue with your payment."}
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button
                variant="outline"
                asChild
                className="border-zinc-700 text-zinc-300"
              >
                <Link href={`/challenges/${challengeId}`}>
                  Back to Challenge
                </Link>
              </Button>
              <Button asChild className="bg-amber-500 text-black hover:bg-amber-400">
                <Link href={`/challenges/${challengeId}`}>
                  Try Again
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
