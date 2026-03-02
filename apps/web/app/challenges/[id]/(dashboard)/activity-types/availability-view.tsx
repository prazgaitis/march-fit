"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Circle,
  CheckCircle2,
  Lock,
  TrendingDown,
  Flame,
  Trophy,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateOnlyToUtcMs, formatDateOnlyFromLocalDate } from "@/lib/date-only";

interface AvailabilityViewProps {
  challengeId: Id<"challenges">;
}

function formatScoringBrief(config: Record<string, unknown>): string {
  if (!config) return "";
  const type = config.type as string | undefined;
  if (type === "tiered") return "tiered";
  if (type === "completion")
    return `${(config.fixedPoints as number) ?? (config.points as number) ?? 0} pts`;
  if (type === "variable") return "variable";
  const ppu = config.pointsPerUnit as number | undefined;
  const unit = config.unit as string | undefined;
  if (ppu && unit) {
    const unitShort: Record<string, string> = {
      miles: "mi",
      kilometers: "km",
      minutes: "min",
      hours: "hr",
      drinks: "drink",
    };
    return `${ppu}/${unitShort[unit] ?? unit}`;
  }
  const pts =
    (config.points as number | undefined) ??
    (config.fixedPoints as number | undefined);
  if (pts) return `${pts} pts`;
  if (config.variants) return "varies";
  return "";
}

const UNIT_LABELS: Record<string, string> = {
  miles: "mi",
  kilometers: "km",
  minutes: "min",
  hours: "hr",
  circuits: "circuits",
  drinks: "drinks",
  horses: "horses",
  burpees: "burpees",
  count: "",
  full_days: "days",
  half_days: "half days",
};

function formatUnitLabel(unit: string, value: number): string {
  const label = UNIT_LABELS[unit] ?? unit;
  if (!label) return "";
  if (value === 1 && label.endsWith("s")) return label.slice(0, -1);
  return label;
}

/**
 * Calculate the minimum amount of an activity needed to earn `pointsNeeded`.
 * Returns null if the activity can't help (variable, negative, completion with 0 pts, etc.)
 */
interface StreakOption {
  name: string;
  amount: number;
  unit: string;
  points: number;
  /** e.g. "8 pts/mi" */
  rate: string | null;
}

function getUnitsForPoints(
  config: Record<string, unknown>,
  pointsNeeded: number,
): Omit<StreakOption, "name"> | null {
  if (pointsNeeded <= 0) return null;
  const type = config.type as string | undefined;

  if (type === "completion") {
    const pts = (config.fixedPoints as number) ?? (config.points as number) ?? 0;
    if (pts <= 0) return null;
    return { amount: 1, unit: "completion", points: pts, rate: null };
  }

  if (type === "tiered") {
    const tiers = config.tiers as Array<{ maxValue?: number; points: number }> | undefined;
    if (!tiers || tiers.length === 0) return null;
    const bestTier = tiers.reduce((best, t) => (t.points > best.points ? t : best), tiers[0]);
    if (bestTier.points <= 0) return null;
    return { amount: 1, unit: "completion", points: bestTier.points, rate: `up to ${bestTier.points} pts` };
  }

  const ppu = config.pointsPerUnit as number | undefined;
  const unit = config.unit as string | undefined;
  if (ppu && ppu > 0 && unit) {
    const amount = Math.ceil((pointsNeeded / ppu) * 10) / 10; // round up to 1 decimal
    const maxUnits = config.maxUnits as number | undefined;
    const cappedAmount = maxUnits ? Math.min(amount, maxUnits) : amount;
    const shortUnit = UNIT_LABELS[unit] ?? unit;
    const rateUnit = shortUnit.endsWith("s") ? shortUnit.slice(0, -1) : shortUnit;
    return {
      amount: cappedAmount,
      unit,
      points: Math.round(cappedAmount * ppu * 10) / 10,
      rate: `${ppu} pts/${rateUnit}`,
    };
  }

  return null;
}

export function AvailabilityView({ challengeId }: AvailabilityViewProps) {
  const todayDateMs = useMemo(() => {
    const todayStr = formatDateOnlyFromLocalDate(new Date());
    return parseDateOnlyToUtcMs(todayStr);
  }, []);

  const data = useQuery(api.queries.activityTypes.getAvailabilityForUser, {
    challengeId,
    todayDateMs,
  });

  if (data === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-zinc-800/50"
          />
        ))}
      </div>
    );
  }

  if (data === null) return null;

  const {
    activityTypes,
    categories,
    currentWeek,
    totalWeeks,
    specialsUsedThisWeek,
    specialsPerWeekLimit,
    todayStreakPoints,
    streakMinPoints,
  } = data;

  // Split into specials/limited (shown first) and regular activities
  const specialsAndLimited: (typeof activityTypes)[number][] = [];
  const regular: (typeof activityTypes)[number][] = [];

  for (const type of activityTypes) {
    const isLimited =
      type.isSpecial ||
      type.effectiveMaxPerChallenge != null ||
      (type.validWeeks && type.validWeeks.length > 0);

    if (!isLimited) {
      regular.push(type);
      continue;
    }

    // Hide week-restricted types that aren't available this week,
    // UNLESS the user has already used some (show their progress)
    const unavailableDueToWeek =
      !type.availableThisWeek &&
      type.validWeeks &&
      type.validWeeks.length > 0;
    if (unavailableDueToWeek && type.challengeUsed === 0) {
      continue;
    }

    specialsAndLimited.push(type);
  }

  // Count available vs completed in specials/limited
  const specialsCompleted = specialsAndLimited.filter(
    (t) => t.isMaxedOut || (!t.availableThisWeek && !t.isNegative)
  ).length;
  const specialsAvailable = specialsAndLimited.filter(
    (t) => !t.isMaxedOut && t.availableThisWeek && !t.isNegative
  ).length;

  // Streak section: quickest ways to reach the threshold
  const pointsRemaining = Math.max(0, streakMinPoints - todayStreakPoints);
  const streakMet = todayStreakPoints >= streakMinPoints;

  const streakOptions: StreakOption[] = [];

  if (!streakMet) {
    // Only consider streak-eligible, available, non-negative, non-maxed types
    for (const type of activityTypes) {
      if (
        !type.contributesToStreak ||
        !type.availableThisWeek ||
        type.isNegative ||
        type.isMaxedOut
      ) continue;

      const config = (type.scoringConfig as Record<string, unknown>) ?? {};
      const result = getUnitsForPoints(config, pointsRemaining);
      if (result) {
        streakOptions.push({
          name: type.name,
          ...result,
        });
      }
    }

    // Sort: unit-based activities first (everyday options), then completions/specials
    // Within each group, sort by points descending (most efficient first)
    const unitGroup = (u: string) => {
      if (u === "completion") return 2;
      if (u === "minutes" || u === "hours") return 1;
      return 0; // distance-based
    };
    streakOptions.sort((a, b) => {
      const ga = unitGroup(a.unit);
      const gb = unitGroup(b.unit);
      if (ga !== gb) return ga - gb;
      return b.points - a.points;
    });
  }

  return (
    <div className="space-y-5">
      {/* Week indicator */}
      <div className="flex justify-center">
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
          Week {currentWeek} of {totalWeeks}
        </span>
      </div>

      {/* Quickest way to streak */}
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Need a quick streak?
        </h3>
        <div className="rounded-lg bg-zinc-900/30 px-3 py-3">
          {/* Progress bar */}
          <div className="mb-2 flex items-center gap-2">
            <Flame className={cn("h-4 w-4", streakMet ? "text-orange-500" : "text-zinc-600")} />
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    streakMet ? "bg-orange-500" : "bg-orange-500/60"
                  )}
                  style={{
                    width: `${Math.min(100, (todayStreakPoints / streakMinPoints) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-xs font-medium tabular-nums text-zinc-400">
              {Math.round(todayStreakPoints * 10) / 10}/{streakMinPoints}
            </span>
          </div>

          {streakMet ? (
            <p className="text-sm text-green-400">
              Streak secured for today!
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-zinc-500">
                Need {Math.round(pointsRemaining * 10) / 10} more streak-eligible pts. Try:
              </p>
              <div className="space-y-1.5">
                {streakOptions.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-zinc-300">{opt.name}</span>
                    <span className="flex-shrink-0 text-right font-mono text-xs text-zinc-400">
                      {opt.unit === "completion" ? (
                        <>{opt.points} pts</>
                      ) : (
                        <>
                          {opt.amount} {formatUnitLabel(opt.unit, opt.amount)}
                          {opt.rate && (
                            <span className="text-zinc-600"> ({opt.rate})</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                ))}
                {streakOptions.length === 0 && (
                  <p className="text-xs text-zinc-600 italic">
                    No streak-eligible activities available
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Specials & Limited section */}
      {specialsAndLimited.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Specials &amp; Limited
            </h3>
            <span className="text-[11px] text-zinc-500">
              {specialsAvailable} available &middot; {specialsCompleted} done
            </span>
          </div>

          {/* Specials weekly limit bar */}
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-2">
            <span className="text-xs text-zinc-400">
              Specials this week
            </span>
            <div className="flex gap-1">
              {Array.from({ length: specialsPerWeekLimit }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full",
                    i < specialsUsedThisWeek
                      ? "bg-indigo-500"
                      : "bg-zinc-700"
                  )}
                />
              ))}
            </div>
            <span className="text-[10px] text-zinc-500">
              {specialsUsedThisWeek}/{specialsPerWeekLimit}
            </span>
          </div>

          <ActivityTypeRows
            types={specialsAndLimited}
            categories={categories}
            currentWeek={currentWeek}
          />
        </div>
      )}

      {/* Regular activities */}
      {regular.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Activities
          </h3>
          <ActivityTypeRows
            types={regular}
            categories={categories}
            currentWeek={currentWeek}
          />
        </div>
      )}
    </div>
  );
}

type EnrichedType = {
  _id: string;
  name: string;
  isNegative: boolean;
  contributesToStreak: boolean;
  scoringConfig: unknown;
  bonusThresholds?: Array<{
    metric: string;
    threshold: number;
    bonusPoints: number;
    description: string;
  }>;
  validWeeks?: number[];
  categoryId: string;
  availableThisWeek: boolean;
  challengeUsed: number;
  weekUsed: number;
  isSpecial: boolean;
  effectiveMaxPerChallenge?: number;
  isMaxedOut: boolean;
};

function ActivityTypeRows({
  types,
  categories,
  currentWeek,
}: {
  types: EnrichedType[];
  categories: Record<string, { _id: string; name: string; sortOrder?: number }>;
  currentWeek: number;
}) {
  return (
    <div className="divide-y divide-zinc-800/60 rounded-lg bg-zinc-900/30">
      {types.map((type) => {
        const unavailable = !type.availableThisWeek || type.isMaxedOut;
        const config = (type.scoringConfig as Record<string, unknown>) ?? {};
        const scoringBrief = formatScoringBrief(config);
        const optionalBonuses = config.optionalBonuses as
          | Array<{ name: string; bonusPoints: number }>
          | undefined;
        const bonusThresholds = type.bonusThresholds;
        const categoryName = type.categoryId
          ? categories[type.categoryId]?.name
          : undefined;

        return (
          <div
            key={type._id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              unavailable && "opacity-50"
            )}
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              <StatusIcon type={type} />
            </div>

            {/* Name + scoring */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-sm font-medium text-zinc-200",
                    unavailable && "line-through"
                  )}
                >
                  {type.name}
                </span>
                {type.contributesToStreak && (
                  <Flame className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {scoringBrief && (
                  <span className="text-xs text-zinc-500">{scoringBrief}</span>
                )}
                {categoryName && (
                  <span className="text-[10px] text-zinc-600">
                    {categoryName}
                  </span>
                )}
                {/* Challenge usage for limited types */}
                {type.effectiveMaxPerChallenge != null && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      type.isMaxedOut
                        ? "bg-green-500/15 text-green-400"
                        : "bg-purple-500/15 text-purple-400"
                    )}
                  >
                    {type.challengeUsed}/{type.effectiveMaxPerChallenge} used
                  </span>
                )}
                {/* Valid weeks badge */}
                {type.validWeeks && type.validWeeks.length > 0 && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      type.validWeeks.includes(currentWeek)
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-zinc-700/50 text-zinc-500"
                    )}
                  >
                    Wk{" "}
                    {type.validWeeks.length <= 3
                      ? type.validWeeks.join(", ")
                      : `${type.validWeeks[0]}–${type.validWeeks[type.validWeeks.length - 1]}`}
                  </span>
                )}
              </div>
            </div>

            {/* Bonus pills */}
            <div className="flex flex-shrink-0 items-center gap-1">
              {bonusThresholds?.map(
                (b: { bonusPoints: number }, i: number) => (
                  <span
                    key={i}
                    className="flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                  >
                    <Trophy className="h-2.5 w-2.5" />+{b.bonusPoints}
                  </span>
                )
              )}
              {optionalBonuses?.map((b, i) => (
                <span
                  key={i}
                  className="flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                >
                  <Zap className="h-2.5 w-2.5" />+{b.bonusPoints}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusIcon({ type }: { type: EnrichedType }) {
  if (type.isNegative) {
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  }
  if (!type.availableThisWeek) {
    return <Lock className="h-4 w-4 text-zinc-600" />;
  }
  if (type.isMaxedOut) {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
  if (
    type.effectiveMaxPerChallenge != null &&
    type.challengeUsed > 0
  ) {
    const remaining = type.effectiveMaxPerChallenge - type.challengeUsed;
    return (
      <span className="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-purple-400">
        {remaining}
      </span>
    );
  }
  return <Circle className="h-4 w-4 text-zinc-600" />;
}
