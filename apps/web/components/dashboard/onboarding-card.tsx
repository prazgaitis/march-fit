"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StravaConnectButton } from "@/components/integrations/strava-connect-button";
import { parseDateOnlyToUtcMs } from "@/lib/date-only";
import {
  CheckCircle2,
  UserPlus,
  CreditCard,
  Loader2,
  Copy,
  Check,
  Share2,
  Mail,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function getOnboardingTitle(startDate: string): string {
  const startMs = parseDateOnlyToUtcMs(startDate);
  const now = Date.now();
  const daysUntilStart = Math.ceil((startMs - now) / (1000 * 60 * 60 * 24));
  if (daysUntilStart > 1) return `${daysUntilStart} days until the challenge`;
  if (daysUntilStart === 1) return "Challenge starts tomorrow";
  return "Getting started";
}

interface OnboardingCardProps {
  challengeId: string;
  userId: string;
  challengeStartDate: string;
}

export function OnboardingCard({ challengeId, userId, challengeStartDate }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Data fetching
  const currentUser = useQuery(api.queries.users.current);
  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });
  const participation = useQuery(
    api.queries.participations.getCurrentUserParticipation,
    { challengeId: challengeId as Id<"challenges"> }
  );
  const paymentInfo = useQuery(api.queries.paymentConfig.getPublicPaymentInfo, {
    challengeId: challengeId as Id<"challenges">,
  });
  const integrations = useQuery(api.queries.integrations.getByUser, {
    userId: userId as Id<"users">,
  });
  const existingInviteCode = useQuery(
    api.queries.challengeInvites.getMyInviteCode,
    { challengeId: challengeId as Id<"challenges"> }
  );

  // Completion checks
  const bioComplete =
    currentUser?.gender != null && currentUser?.age != null;
  const requiresPayment = Boolean(
    paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0
  );
  const paymentComplete = participation?.paymentStatus === "paid";
  const stravaConnected = integrations?.some(
    (i: { service: string; revoked: boolean }) => i.service === "strava" && !i.revoked
  );

  const allCompletableStepsDone =
    bioComplete &&
    (!requiresPayment || paymentComplete) &&
    stravaConnected;

  // Auto-hide when all steps done and dismissed
  if (dismissed && allCompletableStepsDone) {
    return null;
  }

  // Still loading data
  if (
    currentUser === undefined ||
    challenge === undefined ||
    participation === undefined ||
    paymentInfo === undefined ||
    integrations === undefined
  ) {
    return null;
  }

  const allowGenderEdit = challenge?.allowGenderEdit ?? false;
  const genderPrizesStepNeeded = allowGenderEdit && !currentUser?.gender;

  const steps = [
    {
      key: "bio",
      label: "Fill out your bio",
      description: "Gender & age (displayed as decade, e.g. 30s)",
      complete: bioComplete,
      icon: User,
    },
    ...(genderPrizesStepNeeded
      ? [
          {
            key: "gender_prizes",
            label: "Set your gender for prize tracking",
            description: "This challenge awards prizes by gender category",
            complete: false,
            icon: CheckCircle2,
          },
        ]
      : []),
    ...(requiresPayment
      ? [
          {
            key: "payment",
            label: "Complete payment",
            description: `Pay to participate in this challenge`,
            complete: paymentComplete,
            icon: CreditCard,
          },
        ]
      : []),
    {
      key: "strava",
      label: "Link Strava",
      description: "Sync your workouts automatically",
      complete: stravaConnected ?? false,
      icon: CheckCircle2,
    },
    {
      key: "invite",
      label: "Invite friends",
      description: "Share your invite link or send emails",
      complete: false, // Always actionable
      icon: UserPlus,
    },
  ];

  const toggleStep = (index: number) => {
    setExpandedStep(expandedStep === index ? null : index);
  };

  return (
    <Card className="border-indigo-500/30 bg-indigo-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{getOnboardingTitle(challengeStartDate)}</CardTitle>
          </div>
          {allCompletableStepsDone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-xs text-muted-foreground"
            >
              Dismiss
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.key} className="rounded-lg border border-zinc-800">
            <button
              onClick={() => toggleStep(index)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              {step.complete ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
              ) : (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-xs text-muted-foreground">
                  {index + 1}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium ${step.complete ? "text-muted-foreground line-through" : ""}`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
              {expandedStep === index ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {expandedStep === index && (
              <div className="border-t border-zinc-800 p-3">
                {step.key === "bio" && (
                  <BioForm
                    userId={userId}
                    currentGender={currentUser?.gender}
                    currentAge={currentUser?.age}
                  />
                )}
                {step.key === "gender_prizes" && (
                  <GenderPrizesStep
                    userId={userId}
                    challengeId={challengeId}
                  />
                )}
                {step.key === "payment" && (
                  <PaymentStep challengeId={challengeId} />
                )}
                {step.key === "strava" && (
                  <StravaStep
                    challengeId={challengeId}
                    connected={stravaConnected ?? false}
                  />
                )}
                {step.key === "invite" && (
                  <InviteStep
                    challengeId={challengeId}
                    existingCode={existingInviteCode ?? null}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Gender Prizes Step ---
function GenderPrizesStep({
  userId,
  challengeId,
}: {
  userId: string;
  challengeId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const updateUser = useMutation(api.mutations.users.updateUser);

  const handleSave = async (selectedGender: "male" | "female" | "skip") => {
    setSaving(true);
    try {
      if (selectedGender !== "skip") {
        await updateUser({
          userId: userId as Id<"users">,
          gender: selectedGender,
        });
      }
      setSaved(true);
    } catch (error) {
      console.error("Failed to save gender", error);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="text-sm text-green-400 flex items-center gap-2">
        <Check className="h-4 w-4" />
        Saved!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        <p className="font-medium mb-1">🏆 Prize categories</p>
        <p className="text-xs">
          This challenge awards prizes by gender. If you&apos;d like to compete in the Women&apos;s
          category, please set your gender below. If you choose not to set a gender, you&apos;ll be
          placed in the <strong>Men&apos;s/Open</strong> category.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSave("female")}
          disabled={saving}
          className="border-pink-500/50 text-pink-400 hover:bg-pink-500/10"
        >
          Female
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSave("male")}
          disabled={saving}
          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
        >
          Male
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSave("skip")}
          disabled={saving}
          className="text-zinc-500"
        >
          Skip (Men&apos;s/Open)
        </Button>
      </div>
    </div>
  );
}

// --- Bio Form ---
function BioForm({
  userId,
  currentGender,
  currentAge,
}: {
  userId: string;
  currentGender?: string;
  currentAge?: number;
}) {
  const [gender, setGender] = useState<string>(currentGender ?? "");
  const [age, setAge] = useState<string>(currentAge?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const updateUser = useMutation(api.mutations.users.updateUser);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({
        userId: userId as Id<"users">,
        gender: gender as "male" | "female",
        age: parseInt(age, 10),
      });
      setSaved(true);
    } catch (error) {
      console.error("Failed to save bio", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    // Just collapse — no action needed
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="text-sm text-green-400 flex items-center gap-2">
        <Check className="h-4 w-4" />
        Saved!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Gender
          </label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Age
          </label>
          <Input
            type="number"
            placeholder="e.g. 35"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={13}
            max={120}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !gender || !age}
          size="sm"
        >
          {saving ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : null}
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

// --- Payment Step ---
function PaymentStep({ challengeId }: { challengeId: string }) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createCheckoutSession = useMutation(
    api.mutations.payments.createCheckoutSession
  );

  const handlePay = async () => {
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
      setErrorMessage(
        error instanceof Error ? error.message : "Payment failed"
      );
      setIsRedirecting(false);
    }
  };

  return (
    <div className="space-y-2">
      {errorMessage && (
        <div className="text-xs text-red-400">{errorMessage}</div>
      )}
      <Button onClick={handlePay} disabled={isRedirecting} size="sm">
        {isRedirecting ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Redirecting...
          </>
        ) : (
          <>
            <CreditCard className="mr-1 h-3 w-3" />
            Pay now
          </>
        )}
      </Button>
    </div>
  );
}

// --- Strava Step ---
function StravaStep({
  challengeId,
  connected,
}: {
  challengeId: string;
  connected: boolean;
}) {
  if (connected) {
    return (
      <div className="text-sm text-green-400 flex items-center gap-2">
        <Check className="h-4 w-4" />
        Connected
      </div>
    );
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <StravaConnectButton
      successUrl={`${origin}/challenges/${challengeId}/dashboard`}
      errorUrl={`${origin}/challenges/${challengeId}/dashboard`}
    />
  );
}

// --- Invite Step ---
function InviteStep({
  challengeId,
  existingCode,
}: {
  challengeId: string;
  existingCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sentCount: number;
    failedCount: number;
  } | null>(null);

  const generateCode = useMutation(
    api.mutations.challengeInvites.getOrCreateInviteCode
  );
  const sendInviteEmails = useMutation(
    api.mutations.challengeInvites.sendInviteEmails
  );

  const code = inviteCode ?? existingCode;

  const inviteUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/challenges/${challengeId}/invite/${code}`
    : null;

  const handleGenerateCode = async () => {
    try {
      setGenerating(true);
      const result = await generateCode({
        challengeId: challengeId as Id<"challenges">,
      });
      setInviteCode(result);
    } catch (error) {
      console.error("Failed to generate invite code", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my fitness challenge!",
          url: inviteUrl,
        });
      } else {
        await handleCopy();
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        console.error("Share failed", error);
      }
    }
  };

  const handleSendEmails = async () => {
    const emailList = emails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    if (emailList.length === 0) return;

    setSending(true);
    setSendResult(null);
    try {
      // Ensure we have an invite code first
      if (!code) {
        const newCode = await generateCode({
          challengeId: challengeId as Id<"challenges">,
        });
        setInviteCode(newCode);
      }

      const result = await sendInviteEmails({
        challengeId: challengeId as Id<"challenges">,
        emails: emailList,
        origin:
          typeof window !== "undefined" ? window.location.origin : "",
      });
      setSendResult(result);
      setEmails("");
    } catch (error) {
      console.error("Failed to send invite emails", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Invite link section */}
      {code ? (
        <div className="flex gap-2">
          <div className="flex-1 truncate rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-muted-foreground">
            {inviteUrl}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            title="Copy link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleShare}
            title="Share link"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleGenerateCode}
          disabled={generating}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          {generating ? "Generating..." : "Get your invite link"}
        </Button>
      )}

      {/* Email invite section */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="friend@example.com, another@example.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleSendEmails}
            disabled={sending || !emails.trim()}
            size="sm"
          >
            {sending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Mail className="mr-1 h-3 w-3" />
            )}
            Send
          </Button>
        </div>
        {sendResult && (
          <div className="text-xs text-muted-foreground">
            {sendResult.sentCount > 0 && (
              <span className="text-green-400">
                {sendResult.sentCount} invite{sendResult.sentCount !== 1 ? "s" : ""} sent!
              </span>
            )}
            {sendResult.failedCount > 0 && (
              <span className="text-red-400 ml-2">
                {sendResult.failedCount} failed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
