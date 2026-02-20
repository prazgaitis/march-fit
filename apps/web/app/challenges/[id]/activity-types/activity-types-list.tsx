"use client";

import ReactMarkdown from "react-markdown";
import { Flame, TrendingDown, Clock, Route, Hash, Beer, AlertCircle, Calendar, Trophy, Zap, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

// Convert HTML br tags to newlines for markdown rendering
function htmlToMarkdown(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?p>/gi, "\n");
}

interface ScoringConfig {
  type?: string;
  unit?: string;
  pointsPerUnit?: number;
  basePoints?: number;
  points?: number;
  fixedPoints?: number;
  freebiesPerDay?: number;
  dailyFreeUnits?: number;
  maxUnits?: number;
  metric?: string;
  tiers?: Array<{ maxValue?: number; points: number }>;
  optionalBonuses?: Array<{ name: string; bonusPoints: number; description: string }>;
  variants?: Record<string, { name: string; points?: number; pointsPerUnit?: number; unit?: string }>;
  defaultVariant?: string;
}

interface BonusThreshold {
  metric: string;
  threshold: number;
  bonusPoints: number;
  description: string;
}

interface ActivityType {
  _id: string;
  _creationTime?: number;
  challengeId: string;
  name: string;
  description?: string;
  scoringConfig: ScoringConfig;
  contributesToStreak: boolean;
  isNegative: boolean;
  categoryId: string;
  sortOrder?: number;
  bonusThresholds?: BonusThreshold[];
  maxPerChallenge?: number;
  validWeeks?: number[];
}

interface Category {
  _id: string;
  name: string;
  icon?: string;
  sortOrder?: number;
}

interface ActivityTypesListProps {
  activityTypes: ActivityType[];
  categoryMap: Map<string, Category>;
  streakMinPoints: number;
}

function formatUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    miles: "mile",
    kilometers: "km",
    minutes: "minute",
    hours: "hour",
    drinks: "drink",
    completion: "completion",
    circuits: "circuit",
    burpees: "burpee",
    horses: "horse",
    half_days: "half day",
    full_days: "full day",
  };
  return unitMap[unit] || unit;
}

function formatUnitPlural(unit: string, count: number): string {
  const singular = formatUnit(unit);
  if (count === 1) return singular;
  if (singular === "horse") return "horses";
  if (singular === "half day") return "half days";
  if (singular === "full day") return "full days";
  if (singular.endsWith("s")) return singular;
  return singular + "s";
}

function getScoringTypeIcon(config: ScoringConfig | null | undefined, className: string = "h-4 w-4") {
  if (!config) return <Hash className={className} />;
  const unit = config.unit;
  if (unit === "miles" || unit === "kilometers") return <Route className={className} />;
  if (unit === "minutes" || unit === "hours") return <Clock className={className} />;
  if (unit === "drinks") return <Beer className={className} />;
  return <Hash className={className} />;
}

function getExamples(config: ScoringConfig | null | undefined): { value: number; points: string }[] {
  if (!config?.pointsPerUnit || !config?.unit) return [];

  const ppu = Number(config.pointsPerUnit);
  const unit = config.unit;

  if (unit === "miles") {
    return [
      { value: 1, points: ppu.toFixed(1) },
      { value: 3, points: (ppu * 3).toFixed(1) },
      { value: 5, points: (ppu * 5).toFixed(1) },
      { value: 10, points: (ppu * 10).toFixed(1) },
    ];
  }
  if (unit === "kilometers") {
    return [
      { value: 5, points: (ppu * 5).toFixed(1) },
      { value: 10, points: (ppu * 10).toFixed(1) },
      { value: 21, points: (ppu * 21).toFixed(1) },
    ];
  }
  if (unit === "minutes") {
    return [
      { value: 15, points: (ppu * 15).toFixed(1) },
      { value: 30, points: (ppu * 30).toFixed(1) },
      { value: 45, points: (ppu * 45).toFixed(1) },
      { value: 60, points: (ppu * 60).toFixed(1) },
    ];
  }
  return [];
}

export function ActivityTypesList({
  activityTypes,
  categoryMap,
  streakMinPoints,
}: ActivityTypesListProps) {
  // Group activity types by category (skip uncategorized)
  const grouped = activityTypes.reduce(
    (acc, type) => {
      if (!type.categoryId) return acc;
      if (!acc[type.categoryId]) {
        acc[type.categoryId] = [];
      }
      acc[type.categoryId].push(type);
      return acc;
    },
    {} as Record<string, ActivityType[]>
  );

  // Sort activity types within each category by sortOrder (nulls last), then _creationTime
  for (const types of Object.values(grouped)) {
    types.sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
      if (a.sortOrder != null) return -1;
      if (b.sortOrder != null) return 1;
      return (a._creationTime ?? 0) - (b._creationTime ?? 0);
    });
  }

  // Sort category IDs by category sortOrder (nulls last)
  const categoryIds = Object.keys(grouped).sort((a, b) => {
    const catA = categoryMap.get(a);
    const catB = categoryMap.get(b);
    const orderA = catA?.sortOrder;
    const orderB = catB?.sortOrder;
    if (orderA != null && orderB != null) return orderA - orderB;
    if (orderA != null) return -1;
    if (orderB != null) return 1;
    return 0;
  });

  if (activityTypes.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-500">No activity types configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Intro */}
      <section>
        <p className="text-zinc-400 leading-relaxed">
          Earn points by logging activities. Different activities have different point values
          based on distance, duration, or completion.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
          <Flame className="h-5 w-5 flex-shrink-0 text-orange-500 mt-0.5" />
          <div>
            <p className="font-medium text-white">Daily Streak</p>
            <p className="text-sm text-zinc-400">
              Log at least <strong className="text-orange-400">{streakMinPoints} points</strong> each
              day to maintain your streak. Activities marked with <Flame className="inline h-3 w-3 text-orange-500" /> count toward your daily total.
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categoryIds.map((categoryId) => {
        const category = categoryMap.get(categoryId);
        const types = grouped[categoryId];

        return (
          <section key={categoryId}>
            <h2 className="text-xl font-bold text-white border-b border-zinc-800 pb-2 mb-6">
              {category?.name || "Other"}
            </h2>

            <div className="space-y-8">
              {types.map((type) => {
                const config = type.scoringConfig || {};
                const ppu = config.pointsPerUnit;
                const unit = config.unit;
                const examples = getExamples(config);
                const hasVariants = config.variants && typeof config.variants === "object";

                return (
                  <article key={type._id} className="group">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          "rounded-lg p-2 mt-0.5",
                          type.isNegative
                            ? "bg-red-500/10 text-red-400"
                            : "bg-zinc-800 text-zinc-400"
                        )}
                      >
                        {type.isNegative ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          getScoringTypeIcon(config)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-white">
                            {type.name}
                          </h3>
                          {type.contributesToStreak && (
                            <span title="Counts toward streak"><Flame className="h-4 w-4 text-orange-500" /></span>
                          )}
                          {type.isNegative && (
                            <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                              Penalty
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {type.description && (
                          <div className="mt-2 text-sm text-zinc-400 prose prose-sm prose-invert prose-zinc max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                            <ReactMarkdown>
                              {htmlToMarkdown(type.description)}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Restrictions badges */}
                        {(type.maxPerChallenge || type.validWeeks) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {type.maxPerChallenge && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                                <Lock className="h-3 w-3" />
                                {type.maxPerChallenge === 1 ? "One-time only" : `Max ${type.maxPerChallenge}x`}
                              </span>
                            )}
                            {type.validWeeks && type.validWeeks.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                                <Calendar className="h-3 w-3" />
                                Week {type.validWeeks.join(", ")} only
                              </span>
                            )}
                          </div>
                        )}

                        {/* Scoring formula */}
                        <div className="mt-2">
                          {config.type === "tiered" && config.tiers ? (
                            // Tiered scoring display
                            <div className="space-y-1">
                              <p className="text-zinc-500 text-sm">Tiered scoring based on {config.metric?.replace("_", " ")}:</p>
                              <div className="grid gap-1">
                                {config.tiers.map((tier, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm py-0.5 border-b border-zinc-800/50 last:border-0">
                                    <span className="text-zinc-400">
                                      {tier.maxValue !== undefined
                                        ? (i === 0 ? `≤${tier.maxValue}` : `≤${tier.maxValue}`)
                                        : "Default"}
                                    </span>
                                    <span className="font-mono text-indigo-400">{tier.points} pts</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : config.type === "completion" ? (
                            // Completion scoring
                            <div>
                              <p className="text-zinc-300">
                                <span className="font-mono font-semibold text-indigo-400">
                                  +{config.fixedPoints || config.points || 0}
                                </span>
                                <span className="text-zinc-500"> points per completion</span>
                              </p>
                              {config.optionalBonuses && config.optionalBonuses.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-zinc-500">Optional bonuses:</p>
                                  {config.optionalBonuses.map((bonus, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-amber-400">
                                      <Zap className="h-3 w-3" />
                                      <span>{bonus.name}: +{bonus.bonusPoints} pts</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : config.type === "variable" ? (
                            <p className="text-zinc-500 text-sm italic">Points awarded by admin</p>
                          ) : ppu && unit ? (
                            <div>
                              <p className="text-zinc-300">
                                <span className={cn(
                                  "font-mono font-semibold",
                                  type.isNegative ? "text-red-400" : "text-indigo-400"
                                )}>
                                  {type.isNegative ? "−" : ""}{ppu}
                                </span>
                                <span className="text-zinc-500"> points per {formatUnit(unit)}</span>
                                {config.maxUnits && (
                                  <span className="text-zinc-500"> (max {config.maxUnits})</span>
                                )}
                              </p>
                            </div>
                          ) : config.points || config.fixedPoints ? (
                            <p className="text-zinc-300">
                              <span className={cn(
                                "font-mono font-semibold",
                                type.isNegative ? "text-red-400" : "text-indigo-400"
                              )}>
                                {type.isNegative ? "−" : "+"}{config.points || config.fixedPoints}
                              </span>
                              <span className="text-zinc-500"> points per completion</span>
                            </p>
                          ) : hasVariants ? (
                            <p className="text-zinc-500 text-sm">Points vary by option selected</p>
                          ) : null}
                        </div>

                        {/* Bonus thresholds */}
                        {type.bonusThresholds && type.bonusThresholds.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">Distance Bonuses</p>
                            {type.bonusThresholds.map((bonus, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-amber-400">
                                <Trophy className="h-3 w-3" />
                                <span>{bonus.description}: +{bonus.bonusPoints} pts</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Drinks special case */}
                        {unit === "drinks" && (config.freebiesPerDay !== undefined || config.dailyFreeUnits !== undefined) && (
                          <p className="mt-1 text-sm text-zinc-500">
                            First {config.freebiesPerDay ?? config.dailyFreeUnits ?? 1} {formatUnitPlural("drink", config.freebiesPerDay ?? config.dailyFreeUnits ?? 1)} free each day
                          </p>
                        )}

                        {/* Example calculations table */}
                        {examples.length > 0 && (
                          <div className="mt-3 inline-block">
                            <table className="text-sm">
                              <tbody>
                                <tr className="text-zinc-500">
                                  {examples.map((ex) => (
                                    <td key={ex.value} className="pr-6 pb-1">
                                      {ex.value} {formatUnitPlural(unit ?? "unit", ex.value)}
                                    </td>
                                  ))}
                                </tr>
                                <tr className="text-zinc-300 font-medium">
                                  {examples.map((ex) => (
                                    <td key={ex.value} className="pr-6">
                                      {ex.points} pts
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Variants list */}
                        {hasVariants && (
                          <div className="mt-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 mb-2">
                              Options
                            </p>
                            <div className="grid gap-1">
                              {Object.values(config.variants!)
                                .slice(0, 5)
                                .map((variant, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800/50 last:border-0">
                                    <span className="text-zinc-400">{variant.name}</span>
                                    <span className="font-mono text-zinc-300">
                                      {variant.points !== undefined
                                        ? `${variant.points} pts`
                                        : variant.pointsPerUnit
                                          ? `${variant.pointsPerUnit}/${formatUnit(variant.unit || unit || "unit")}`
                                          : "—"}
                                    </span>
                                  </div>
                                ))}
                              {config.variants && Object.keys(config.variants).length > 5 && (
                                <p className="text-xs text-zinc-600 mt-1">
                                  +{Object.keys(config.variants).length - 5} more options
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Footer note */}
      <section className="border-t border-zinc-800 pt-6">
        <div className="flex items-start gap-2 text-sm text-zinc-500">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Points are calculated automatically when you log an activity.
            Some activities may have bonus multipliers or special rules during certain periods.
          </p>
        </div>
      </section>
    </div>
  );
}
