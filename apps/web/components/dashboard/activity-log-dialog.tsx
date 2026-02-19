"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Calendar, Check, CheckCircle, ChevronsUpDown, CreditCard, ImagePlus, Loader2, Lock, PlusCircle, X, Zap } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id, Doc } from "@repo/backend/_generated/dataModel";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";
import { isEditorContentEmpty } from "@/lib/rich-text-utils";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";
import { localDateToIsoNoon, formatDateOnlyFromLocalDate, formatDateShortFromDateOnly } from "@/lib/date-only";

interface ActivityLogDialogProps {
  challengeId: string;
  challengeStartDate?: string;
  trigger?: React.ReactNode;
}

interface FormState {
  activityTypeId: string;
  metricValue: string;
  selectedVariant: string;
  selectedBonuses: string[];
  notes: string;
  loggedDate?: Date;
}

function createInitialFormState(): FormState {
  return {
    activityTypeId: "",
    metricValue: "",
    selectedVariant: "",
    selectedBonuses: [],
    notes: "",
    loggedDate: new Date(),
  };
}

interface VariantOption {
  key: string;
  name: string;
  points?: number;
  pointsPerUnit?: number;
  unit?: string;
}

function toSentenceCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(.)/, (match) => match.toUpperCase());
}

function parseNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatPoints(value: number): string {
  const normalized = Math.round((value + Number.EPSILON) * 100) / 100;
  return normalized.toString();
}

interface MediaPreview {
  file: File;
  url: string;
  type: "image" | "video";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

interface SuccessState {
  pointsEarned: number;
  activityName: string;
  basePoints: number;
  bonusPoints: number;
  triggeredBonuses: string[];
}

export function ActivityLogDialog({ challengeId, challengeStartDate, trigger }: ActivityLogDialogProps) {
  const [open, setOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const { users: mentionUsers } = useMentionableUsers(challengeId);
  const [notesIsEmpty, setNotesIsEmpty] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<MediaPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activityTypes = useQuery(
    api.queries.activityTypes.getByChallengeId,
    open ? { challengeId: challengeId as Id<"challenges"> } : "skip"
  );

  const logActivity = useMutation(api.mutations.activities.log);
  const createCheckoutSession = useAction(api.actions.payments.createCheckoutSession);
  const generateUploadUrl = useMutation(api.mutations.activities.generateUploadUrl);

  const paymentInfo = useQuery(api.queries.paymentConfig.getPublicPaymentInfo, {
    challengeId: challengeId as Id<"challenges">,
  });

  const participation = useQuery(
    api.queries.participations.getCurrentUserParticipation,
    { challengeId: challengeId as Id<"challenges"> }
  );

  const requiresPayment = Boolean(
    paymentInfo?.requiresPayment && paymentInfo.priceInCents > 0
  );

  const needsPayment =
    requiresPayment && participation && participation.paymentStatus !== "paid";

  const challengeNotStarted = challengeStartDate
    ? formatDateOnlyFromLocalDate(new Date()) < challengeStartDate
    : false;

  const formatPrice = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handleCompletePayment = async () => {
    if (!paymentInfo) return;
    setFormError(null);
    setSubmitting(true);

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
      setFormError(error instanceof Error ? error.message : "Payment failed");
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        loggedDate: new Date(),
      }));
      setFormError(null);
      setSuccessState(null);
    } else {
      setFormError(null);
    }
  }, [open]);

  // Auto-dismiss after success (longer timeout if bonuses were earned)
  useEffect(() => {
    if (successState) {
      const timeout = successState.triggeredBonuses.length > 0 ? 3500 : 2000;
      dismissTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, timeout);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [successState]);

  const selectedActivityType = useMemo(
    () =>
      form.activityTypeId && activityTypes
        ? activityTypes.find((type: Doc<"activityTypes">) => type._id === form.activityTypeId) ?? null
        : null,
    [activityTypes, form.activityTypeId],
  );

  const metricKey = useMemo(() => {
    const config = (selectedActivityType?.scoringConfig as Record<string, unknown>) ?? undefined;
    if (!config) return null;

    // For tiered scoring, use the metric field
    const scoringType = config["type"] as string | undefined;
    if (scoringType === "tiered") {
      const metric = config["metric"] as string | undefined;
      return metric && metric.trim().length > 0 ? metric : null;
    }

    // For completion-type activities, no metric input needed
    if (scoringType === "completion" || scoringType === "variable") {
      return "completion";
    }

    // Standard unit-based scoring
    const unit = typeof config["unit"] === "string" ? config["unit"] : null;
    return unit && unit.trim().length > 0 ? unit : null;
  }, [selectedActivityType]);

  const isCompletionActivity = useMemo(() => {
    return metricKey === "completion" || metricKey === "completions";
  }, [metricKey]);

  // Extract variants from activity type config
  const activityVariants = useMemo((): VariantOption[] => {
    if (!selectedActivityType) return [];

    const config = (selectedActivityType.scoringConfig as Record<string, unknown>) ?? {};
    const variants = config["variants"] as Record<string, { name: string; points?: number; pointsPerUnit?: number; unit?: string }> | undefined;
    const defaultVariant = config["defaultVariant"] as string | undefined;

    if (!variants || typeof variants !== "object") return [];

    return Object.entries(variants).map(([key, variant]) => ({
      key,
      name: variant.name || key,
      points: variant.points,
      pointsPerUnit: variant.pointsPerUnit,
      unit: variant.unit,
      isDefault: key === defaultVariant,
    }));
  }, [selectedActivityType]);

  const hasVariants = activityVariants.length > 0;

  // Calculate which threshold bonuses would be triggered
  const triggeredThresholds = useMemo(() => {
    if (!selectedActivityType || !metricKey) return [];

    const thresholds = (selectedActivityType as { bonusThresholds?: Array<{
      metric: string;
      threshold: number;
      bonusPoints: number;
      description: string;
    }> }).bonusThresholds;

    if (!thresholds || thresholds.length === 0) return [];

    const value = parseNumber(form.metricValue);
    if (value === null) return [];

    // Map metric key to threshold metric format
    const metricMapping: Record<string, string> = {
      miles: "distance_miles",
      kilometers: "distance_km",
      km: "distance_km",
      minutes: "duration_minutes",
    };
    const thresholdMetric = metricMapping[metricKey] || metricKey;

    return thresholds.filter(
      (t) => t.metric === thresholdMetric && value >= t.threshold
    );
  }, [selectedActivityType, metricKey, form.metricValue]);

  // Calculate optional bonus points from selected bonuses
  const optionalBonusPoints = useMemo(() => {
    if (!selectedActivityType) return 0;
    const config = (selectedActivityType.scoringConfig as Record<string, unknown>) ?? {};
    const optionalBonuses = config["optionalBonuses"] as Array<{ name: string; bonusPoints: number }> | undefined;
    if (!optionalBonuses) return 0;
    return form.selectedBonuses.reduce((sum, bonusName) => {
      const bonus = optionalBonuses.find((b) => b.name === bonusName);
      return sum + (bonus?.bonusPoints ?? 0);
    }, 0);
  }, [selectedActivityType, form.selectedBonuses]);

  const estimatedPoints = useMemo(() => {
    if (!selectedActivityType) {
      return null;
    }

    const config = (selectedActivityType.scoringConfig as Record<string, unknown>) ?? {};
    const scoringType = config["type"] as string | undefined;

    let basePoints: number | null = null;

    // Handle tiered scoring
    if (scoringType === "tiered") {
      const tiers = config["tiers"] as Array<{ maxValue?: number; points: number }> | undefined;
      const value = parseNumber(form.metricValue);
      if (tiers && value !== null) {
        // Find the appropriate tier
        for (const tier of tiers) {
          if (tier.maxValue === undefined || value <= tier.maxValue) {
            basePoints = tier.points;
            break;
          }
        }
        if (basePoints === null && tiers.length > 0) {
          basePoints = tiers[tiers.length - 1].points;
        }
      }
      if (basePoints === null) return null;
      return basePoints + optionalBonusPoints;
    }

    // Handle completion scoring
    if (scoringType === "completion") {
      const fixedPoints = parseNumber(config["fixedPoints"] ?? config["points"] ?? 0);
      basePoints = fixedPoints ?? 0;
      return basePoints + optionalBonusPoints;
    }

    // Handle variable (admin-controlled) - no estimate possible
    if (scoringType === "variable") {
      return null;
    }

    // If has variants, use the selected variant's points
    if (hasVariants && form.selectedVariant) {
      const selectedVariantOption = activityVariants.find(v => v.key === form.selectedVariant);
      if (selectedVariantOption?.points !== undefined) {
        basePoints = selectedVariantOption.points;
      } else if (selectedVariantOption?.pointsPerUnit !== undefined) {
        const value = parseNumber(form.metricValue);
        if (value !== null) {
          basePoints = selectedVariantOption.pointsPerUnit * value;
        }
      }
    }

    if (basePoints === null) {
      const base = parseNumber(config["basePoints"] ?? 0) ?? 0;
      const perUnit = parseNumber(config["pointsPerUnit"]) ?? null;
      const maxUnits = config["maxUnits"] as number | undefined;
      let value = parseNumber(form.metricValue);

      // Apply maxUnits cap
      if (value !== null && maxUnits !== undefined && value > maxUnits) {
        value = maxUnits;
      }

      if (!metricKey || metricKey === "completion") {
        if (perUnit !== null) {
          basePoints = perUnit + base;
        } else {
          basePoints = base || null;
        }
      } else if (value !== null && perUnit !== null) {
        basePoints = base + perUnit * value;
      }
    }

    if (basePoints === null) return null;

    // Add threshold bonuses, optional bonuses, and media bonus
    const bonusPoints = triggeredThresholds.reduce((sum, t) => sum + t.bonusPoints, 0);
    const mediaBonusPoints = mediaFiles.length > 0 ? 1 : 0;

    return basePoints + bonusPoints + optionalBonusPoints + mediaBonusPoints;
  }, [selectedActivityType, metricKey, form.metricValue, hasVariants, form.selectedVariant, activityVariants, triggeredThresholds, optionalBonusPoints, mediaFiles.length]);

  // Set default value for completion activities
  useEffect(() => {
    if (isCompletionActivity && form.metricValue === "") {
      setForm((prev) => ({
        ...prev,
        metricValue: "1",
      }));
    }
  }, [isCompletionActivity, form.metricValue]);

  // Auto-select default variant when activity type changes
  useEffect(() => {
    if (hasVariants && !form.selectedVariant) {
      const config = (selectedActivityType?.scoringConfig as Record<string, unknown>) ?? {};
      const defaultVariant = config["defaultVariant"] as string | undefined;
      if (defaultVariant) {
        setForm((prev) => ({
          ...prev,
          selectedVariant: defaultVariant,
        }));
      } else if (activityVariants.length > 0) {
        // Select first variant if no default
        setForm((prev) => ({
          ...prev,
          selectedVariant: activityVariants[0].key,
        }));
      }
    }
  }, [hasVariants, form.selectedVariant, selectedActivityType, activityVariants]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Clear auto-dismiss timeout
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      setForm(createInitialFormState());
      setSuccessState(null);
      setNotesIsEmpty(true);
      setComboboxOpen(false);
      // Clean up media previews
      mediaFiles.forEach((media) => URL.revokeObjectURL(media.url));
      setMediaFiles([]);
      setUploadProgress(null);
    }
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newFiles: MediaPreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setFormError(`File "${file.name}" is not a supported format`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFormError(`File "${file.name}" exceeds 50MB limit`);
        continue;
      }

      const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
      newFiles.push({
        file,
        url: URL.createObjectURL(file),
        type: isVideo ? "video" : "image",
      });
    }

    setMediaFiles((prev) => [...prev, ...newFiles].slice(0, 4)); // Max 4 files
  }, []);

  const handleRemoveMedia = useCallback((index: number) => {
    setMediaFiles((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (needsPayment) {
      setFormError("Complete payment to log activities in this challenge.");
      return;
    }

    if (!form.activityTypeId) {
      setFormError("Please select an activity type");
      return;
    }

    if (!form.loggedDate) {
      setFormError("Please choose when this activity happened");
      return;
    }

    const metrics: Record<string, unknown> = {};
    if (metricKey && metricKey !== "completion") {
      const value = parseNumber(form.metricValue);
      if (value === null) {
        setFormError(
          `Enter a numeric value for ${toSentenceCase(metricKey)}`,
        );
        return;
      }
      metrics[metricKey] = value;
    }

    // Include selected variant in metrics
    if (hasVariants && form.selectedVariant) {
      metrics["variant"] = form.selectedVariant;
    }

    // Include selected bonuses in metrics
    if (form.selectedBonuses.length > 0) {
      metrics["selectedBonuses"] = form.selectedBonuses;
    }

    setSubmitting(true);
    setFormError(null);
    setSuccessState(null);

    try {
      // Upload media files first
      let mediaIds: Id<"_storage">[] | undefined;
      if (mediaFiles.length > 0) {
        setUploadProgress(`Uploading ${mediaFiles.length} file(s)...`);
        mediaIds = [];
        for (let i = 0; i < mediaFiles.length; i++) {
          setUploadProgress(`Uploading file ${i + 1} of ${mediaFiles.length}...`);
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": mediaFiles[i].file.type },
            body: mediaFiles[i].file,
          });
          if (!response.ok) {
            throw new Error(`Failed to upload file ${i + 1}`);
          }
          const { storageId } = await response.json();
          mediaIds.push(storageId);
        }
        setUploadProgress(null);
      }

      const result = await logActivity({
        challengeId: challengeId as Id<"challenges">,
        activityTypeId: form.activityTypeId as Id<"activityTypes">,
        loggedDate: localDateToIsoNoon(form.loggedDate),
        metrics,
        notes: !notesIsEmpty && form.notes && !isEditorContentEmpty(form.notes) ? form.notes : undefined,
        mediaIds,
        source: "manual",
      });

      // Clean up media previews
      mediaFiles.forEach((media) => URL.revokeObjectURL(media.url));
      setMediaFiles([]);

      // Show success state (auto-dismisses after 2s)
      setSuccessState({
        pointsEarned: result.pointsEarned,
        activityName: selectedActivityType?.name ?? "Activity",
        basePoints: result.basePoints,
        bonusPoints: result.bonusPoints,
        triggeredBonuses: result.triggeredBonuses ?? [],
      });
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : "Something went wrong");
      setUploadProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = activityTypes === undefined;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full" size="lg">
            <PlusCircle className="mr-2 h-4 w-4" /> Log activity
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        {needsPayment ? (
          <div className="space-y-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Payment required</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Complete payment before logging activities.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <ResponsiveDialogBody className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4" />
                  Payment needed to log activities
                </div>
                <p className="mt-2 text-xs text-amber-100/80">
                  {paymentInfo
                    ? `This challenge requires a ${formatPrice(
                        paymentInfo.priceInCents,
                        paymentInfo.currency
                      )} payment.`
                    : "This challenge requires payment."}
                </p>
                {participation?.paymentStatus === "failed" ? (
                  <p className="mt-2 text-xs text-red-200">
                    Your last payment attempt failed. Please try again.
                  </p>
                ) : null}
              </div>
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Payment error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </ResponsiveDialogBody>
            <ResponsiveDialogFooter>
              <Button
                onClick={handleCompletePayment}
                disabled={submitting}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {submitting ? (
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
            </ResponsiveDialogFooter>
          </div>
        ) : challengeNotStarted ? (
          <div className="space-y-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Challenge not started</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                This challenge has not started yet.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <ResponsiveDialogBody>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-zinc-300">
                <div className="flex items-center gap-2 font-semibold">
                  <Calendar className="h-4 w-4" />
                  Activities can be logged starting {challengeStartDate ? formatDateShortFromDateOnly(challengeStartDate) : "soon"}
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Check back when the challenge begins to start logging your activities.
                </p>
              </div>
            </ResponsiveDialogBody>
          </div>
        ) : successState ? (
          // Success View
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 rounded-full bg-green-500/10 p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold">Activity Logged!</h3>
            <p className="mt-2 text-muted-foreground">
              {successState.activityName}
            </p>
            <p className="mt-1 text-2xl font-bold text-green-500">
              +{formatPoints(successState.pointsEarned)} pts
            </p>
            {successState.triggeredBonuses.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {formatPoints(successState.basePoints)} base + {formatPoints(successState.bonusPoints)} bonus
                </p>
                {successState.triggeredBonuses.map((bonus, i) => (
                  <Badge key={i} variant="secondary" className="bg-amber-500/10 text-amber-500">
                    {bonus}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Form View
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Log manual activity</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Record workouts and habits that are not automatically synced.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
              <ResponsiveDialogBody className="space-y-4">
                {formError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Submission error</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
            <div className="space-y-2">
              <Label htmlFor="activity-type">Activity type</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between h-auto min-h-[44px] px-3 py-2 text-left font-normal"
                    disabled={isLoading || (activityTypes && activityTypes.length === 0)}
                  >
                    {form.activityTypeId && activityTypes
                      ? (() => {
                          const type = activityTypes.find((t: Doc<"activityTypes">) => t._id === form.activityTypeId);
                          return type ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="font-medium">{type.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {type.isNegative ? "Penalty" : "Workout"}
                                {type.contributesToStreak ? " • Counts toward streak" : ""}
                              </span>
                            </div>
                          ) : "Select activity type...";
                        })()
                      : "Select activity type..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[60]" align="start">
                  <Command className="h-auto">
                    <CommandInput placeholder="Search activity type..." />
                    <CommandList>
                      <CommandEmpty>No activity type found.</CommandEmpty>
                      <CommandGroup>
                        {activityTypes?.map((type: Doc<"activityTypes">) => (
                          <CommandItem
                            key={type._id}
                            value={type.name}
                            onSelect={() => {
                              setForm((prev) => ({
                                ...prev,
                                activityTypeId: type._id,
                                metricValue: "",
                                selectedVariant: "",
                                selectedBonuses: [],
                              }));
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.activityTypeId === type._id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{type.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {type.isNegative ? "Penalty" : "Workout"}
                                {type.contributesToStreak
                                  ? " • Counts toward streak"
                                  : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!isLoading && activityTypes && activityTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity types are available yet. Reach out to the
                  challenge organizer to configure them.
                </p>
              ) : null}
            </div>

            {selectedActivityType ? (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={selectedActivityType.isNegative ? "destructive" : "secondary"}
                  >
                    {selectedActivityType.isNegative ? "Penalty" : "Points"}
                  </Badge>
                  <span>
                    {selectedActivityType.contributesToStreak
                      ? "Counts toward daily streak"
                      : "Does not affect streak"}
                  </span>
                </div>

                {/* Restriction badges */}
                {(selectedActivityType.maxPerChallenge || selectedActivityType.validWeeks) && (
                  <div className="flex flex-wrap gap-2">
                    {selectedActivityType.maxPerChallenge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                        <Lock className="h-3 w-3" />
                        {selectedActivityType.maxPerChallenge === 1 ? "One-time only" : `Max ${selectedActivityType.maxPerChallenge}x`}
                      </span>
                    )}
                    {selectedActivityType.validWeeks && selectedActivityType.validWeeks.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                        <Calendar className="h-3 w-3" />
                        Week {selectedActivityType.validWeeks.join(", ")} only
                      </span>
                    )}
                  </div>
                )}

                <div className="text-muted-foreground">
                  {(() => {
                    const config = (selectedActivityType.scoringConfig as Record<string, unknown>) ?? {};
                    const scoringType = config["type"] as string | undefined;

                    if (scoringType === "tiered") {
                      return <span>Tiered scoring based on performance</span>;
                    }
                    if (scoringType === "completion") {
                      const fixedPoints = parseNumber(config["fixedPoints"]) ?? parseNumber(config["points"]) ?? 0;
                      return <span>Fixed {fixedPoints} points per completion</span>;
                    }
                    if (scoringType === "variable") {
                      return <span className="italic">Points awarded by admin</span>;
                    }
                    if (metricKey) {
                      const ppu = parseNumber(config["pointsPerUnit"]);
                      const maxUnits = config["maxUnits"] as number | undefined;
                      return (
                        <span>
                          Points per {metricKey}: {ppu?.toFixed(2) ?? "—"}
                          {maxUnits && ` (max ${maxUnits})`}
                        </span>
                      );
                    }
                    return <span>Fixed points activity</span>;
                  })()}
                </div>
              </div>
            ) : null}

            {/* Variant Selection */}
            {hasVariants && (
              <div className="space-y-2">
                <Label>Variant</Label>
                <div className="space-y-2">
                  {activityVariants.map((variant) => (
                    <label
                      key={variant.key}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                        form.selectedVariant === variant.key
                          ? "border-primary bg-primary/5"
                          : "border-zinc-700 hover:border-zinc-500"
                      )}
                    >
                      <input
                        type="radio"
                        name="activity-variant"
                        value={variant.key}
                        checked={form.selectedVariant === variant.key}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            selectedVariant: e.target.value,
                          }))
                        }
                        className="h-4 w-4 text-primary"
                      />
                      <div className="flex-1">
                        <span className="font-medium">{variant.name}</span>
                        {variant.points !== undefined && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            {variant.points} pts
                          </span>
                        )}
                        {variant.pointsPerUnit !== undefined && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            {variant.pointsPerUnit} pts/{variant.unit || "unit"}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Bonuses Selection */}
            {selectedActivityType && (() => {
              const config = (selectedActivityType.scoringConfig as Record<string, unknown>) ?? {};
              const optionalBonuses = config["optionalBonuses"] as Array<{ name: string; bonusPoints: number; description: string }> | undefined;
              if (!optionalBonuses || optionalBonuses.length === 0) return null;
              return (
                <div className="space-y-2">
                  <Label>Optional Bonuses</Label>
                  <div className="space-y-2">
                    {optionalBonuses.map((bonus) => (
                      <label
                        key={bonus.name}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                          form.selectedBonuses.includes(bonus.name)
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-zinc-700 hover:border-zinc-500"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={form.selectedBonuses.includes(bonus.name)}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              selectedBonuses: e.target.checked
                                ? [...prev.selectedBonuses, bonus.name]
                                : prev.selectedBonuses.filter((b) => b !== bonus.name),
                            }));
                          }}
                          className="h-4 w-4 text-amber-500"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{bonus.name}</span>
                          <span className="ml-2 text-sm text-amber-400">
                            +{bonus.bonusPoints} pts
                          </span>
                          {bonus.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{bonus.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="logged-date">Date</Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      loggedDate: new Date(),
                    }))
                  }
                >
                  Use today
                </Button>
              </div>
              <DatePicker
                value={form.loggedDate}
                onChange={(date) =>
                  setForm((prev) => ({
                    ...prev,
                    loggedDate: date,
                  }))
                }
              />
              {form.loggedDate && !isToday(form.loggedDate) && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Please try to log activities on the day you complete them.
                </p>
              )}
            </div>

            {metricKey ? (
              <div className="space-y-2">
                <Label htmlFor="metric-value">
                  {isCompletionActivity ? "Completion" : toSentenceCase(metricKey)}
                </Label>
                {isCompletionActivity ? (
                  <Input
                    id="metric-value"
                    type="text"
                    value="1"
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <Input
                    id="metric-value"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder={`Enter ${toSentenceCase(metricKey)}`}
                    value={form.metricValue}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        metricValue: event.target.value,
                      }))
                    }
                    required
                  />
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <RichTextEditor
                id="notes"
                value={form.notes}
                onChange={(content) =>
                  setForm((prev) => ({
                    ...prev,
                    notes: content,
                  }))
                }
                onIsEmptyChange={setNotesIsEmpty}
                placeholder="Add context or details for your teammates"
                mentionOptions={mentionUsers}
                className="mt-1"
              />
            </div>

            {/* Media Upload Section */}
            <div className="space-y-2">
              <Label>Photos & Videos (optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              {/* Preview Grid */}
              {mediaFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {mediaFiles.map((media, index) => (
                    <div
                      key={index}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
                    >
                      {media.type === "image" ? (
                        <img
                          src={media.url}
                          alt={`Upload preview ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <video
                          src={media.url}
                          className="h-full w-full object-cover"
                          muted
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(index)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {media.type === "video" && (
                        <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                          Video
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Media Button */}
              {mediaFiles.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 py-4 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-300"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span>Add photos or videos</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Up to 4 files. Max 50MB each. JPEG, PNG, GIF, WebP, MP4, MOV, WebM.
              </p>
            </div>

            <div className="rounded-lg border bg-background p-4 text-sm">
              <p className="font-medium text-foreground">Points preview</p>
              {selectedActivityType ? (
                <>
                  <p className="mt-1 text-muted-foreground">
                    {estimatedPoints !== null
                      ? `${estimatedPoints.toFixed(2)} points (estimated)`
                      : "Points will be calculated when you submit."}
                  </p>
                  {(triggeredThresholds.length > 0 || mediaFiles.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {triggeredThresholds.map((bonus, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500"
                        >
                          <Zap className="h-3 w-3" />
                          {bonus.description} (+{bonus.bonusPoints})
                        </span>
                      ))}
                      {mediaFiles.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
                          <Zap className="h-3 w-3" />
                          Photo bonus (+1)
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Select an activity to view how points are calculated.
                </p>
              )}
            </div>
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <Button type="submit" disabled={submitting || isLoading} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress ?? "Logging activity"}
                </>
              ) : (
                "Log activity"
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
