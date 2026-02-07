import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

interface BonusThreshold {
  metric: string;
  threshold: number;
  bonusPoints: number;
  description: string;
}

export interface ScoringContext {
  ctx: QueryCtx | MutationCtx;
  metrics: Record<string, unknown>;
  userId: Id<"users">;
  challengeId: Id<"challenges">;
  loggedDate: Date;
}

function toNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getScoringConfig(activityType: Doc<"activityTypes">): Record<string, unknown> {
  return (activityType.scoringConfig as Record<string, unknown>) ?? {};
}

/**
 * Default scorer - base points + unit-based calculation
 */
async function calculateDefaultPoints(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): Promise<number> {
  const config = getScoringConfig(activityType);
  const { unit, pointsPerUnit = 1, basePoints = 0 } = config;

  if (!unit || !context.metrics[unit as string]) {
    return toNumber(basePoints);
  }

  const unitValue = toNumber(context.metrics[unit as string]);
  return toNumber(basePoints) + unitValue * toNumber(pointsPerUnit);
}

/**
 * Drink scorer - handles daily limit/freebie logic for negative points
 */
async function calculateDrinkPoints(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): Promise<number> {
  const config = getScoringConfig(activityType);
  const pointsPerUnit = toNumber(config["pointsPerUnit"]);
  const freebiesPerDay = toNumber(config["freebiesPerDay"] ?? 1);

  const currentValue = toNumber(context.metrics["drinks"]);

  // Get existing drinks total for the day
  const startOfDayUtc = Date.UTC(
    context.loggedDate.getUTCFullYear(),
    context.loggedDate.getUTCMonth(),
    context.loggedDate.getUTCDate()
  );
  const endOfDayUtc = startOfDayUtc + 24 * 60 * 60 * 1000;

  const existingDrinksLogs = await context.ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q) =>
      q
        .eq("userId", context.userId)
        .eq("challengeId", context.challengeId)
        .gte("loggedDate", startOfDayUtc)
        .lt("loggedDate", endOfDayUtc)
    )
    .filter((q) => q.eq(q.field("activityTypeId"), activityType._id))
    .collect();

  const existingTotal = existingDrinksLogs.reduce((sum, entry) => {
    const metricsRecord = (entry.metrics ?? {}) as Record<string, unknown>;
    const value = toNumber(metricsRecord["drinks"]);
    return sum + value;
  }, 0);

  const totalAfter = existingTotal + currentValue;
  const penaltyUnitsBefore = Math.max(0, existingTotal - freebiesPerDay);
  const penaltyUnitsAfter = Math.max(0, totalAfter - freebiesPerDay);
  const penaltyUnitsForEntry = penaltyUnitsAfter - penaltyUnitsBefore;

  return penaltyUnitsForEntry * pointsPerUnit;
}

interface VariantCondition {
  field: string;
  operator: "eq" | "lte" | "gte" | "lt" | "gt";
  value: unknown;
}

interface VariantConfig {
  name: string;
  points?: number;
  basePoints?: number;
  pointsPerUnit?: number;
  unit?: string;
  condition?: VariantCondition;
  validFrom?: string;
  validTo?: string;
}

function isVariantValidOnDate(variant: VariantConfig, loggedDate: Date): boolean {
  const loggedDateString = loggedDate.toISOString().split("T")[0];

  if (!variant.validFrom && !variant.validTo) {
    return true;
  }

  if (variant.validFrom && loggedDateString < variant.validFrom) {
    return false;
  }

  if (variant.validTo && loggedDateString > variant.validTo) {
    return false;
  }

  return true;
}

function filterVariantsByDate(
  variants: Record<string, VariantConfig>,
  loggedDate: Date
): Record<string, VariantConfig> {
  const filtered: Record<string, VariantConfig> = {};

  for (const [key, variant] of Object.entries(variants)) {
    if (isVariantValidOnDate(variant, loggedDate)) {
      filtered[key] = variant;
    }
  }

  return filtered;
}

function evaluateCondition(
  condition: VariantCondition,
  metrics: Record<string, unknown>
): boolean {
  if (!(condition.field in metrics)) {
    return false;
  }

  const fieldValue = toNumber(metrics[condition.field]);
  const conditionValue = toNumber(condition.value);

  if (fieldValue === 0 && metrics[condition.field] === undefined) {
    return false;
  }

  switch (condition.operator) {
    case "eq":
      return fieldValue === conditionValue;
    case "lte":
      return fieldValue <= conditionValue;
    case "gte":
      return fieldValue >= conditionValue;
    case "lt":
      return fieldValue < conditionValue;
    case "gt":
      return fieldValue > conditionValue;
    default:
      return false;
  }
}

function findVariantByCondition(
  variants: Record<string, VariantConfig>,
  metrics: Record<string, unknown>
): string | undefined {
  const conditionalVariants = Object.entries(variants)
    .filter(([, variant]) => variant.condition)
    .sort(([, a], [, b]) => {
      const aValue = toNumber(a.condition?.value);
      const bValue = toNumber(b.condition?.value);
      return aValue - bValue;
    });

  for (const [key, variant] of conditionalVariants) {
    if (evaluateCondition(variant.condition!, metrics)) {
      return key;
    }
  }

  return undefined;
}

function calculateVariantPoints(
  variantConfig: VariantConfig,
  metrics: Record<string, unknown>,
  mainConfig: Record<string, unknown>
): number {
  if (variantConfig.points !== undefined) {
    return toNumber(variantConfig.points);
  }

  const { unit, pointsPerUnit = 1, basePoints = 0 } = variantConfig;
  const scoringUnit = unit || mainConfig["unit"];

  if (!scoringUnit || !metrics[scoringUnit as string]) {
    return toNumber(basePoints);
  }

  const unitValue = toNumber(metrics[scoringUnit as string]);
  return toNumber(basePoints) + unitValue * toNumber(pointsPerUnit);
}

/**
 * Variant scorer - handles conditional and manual variant selection
 */
async function calculateVariantPoints_full(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): Promise<number> {
  const config = getScoringConfig(activityType);
  const variants = config["variants"] as Record<string, VariantConfig> | undefined;
  const defaultVariant = config["defaultVariant"] as string | undefined;

  if (!variants) {
    return calculateDefaultPoints(activityType, context);
  }

  const validVariants = filterVariantsByDate(variants, context.loggedDate);

  const requestedVariant = context.metrics["variant"] as string | undefined;
  let selectedVariantKey: string | undefined;

  if (requestedVariant && validVariants[requestedVariant]) {
    selectedVariantKey = requestedVariant;
  } else {
    selectedVariantKey = findVariantByCondition(validVariants, context.metrics);
  }

  if (!selectedVariantKey && defaultVariant && validVariants[defaultVariant]) {
    selectedVariantKey = defaultVariant;
  }

  if (!selectedVariantKey || !validVariants[selectedVariantKey]) {
    return calculateDefaultPoints(activityType, context);
  }

  const variantConfig = validVariants[selectedVariantKey];
  return calculateVariantPoints(variantConfig, context.metrics, config);
}

/**
 * Tiered scoring - returns points based on where metric value falls in tiers
 */
function calculateTieredPoints(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): number {
  const config = getScoringConfig(activityType);
  const metric = config["metric"] as string | undefined;
  const tiers = config["tiers"] as Array<{ maxValue?: number; points: number }> | undefined;

  if (!metric || !tiers || tiers.length === 0) {
    return 0;
  }

  const metricValue = toNumber(context.metrics[metric]);

  // Find the appropriate tier (tiers should be ordered from lowest to highest maxValue)
  for (const tier of tiers) {
    if (tier.maxValue === undefined || metricValue <= tier.maxValue) {
      return tier.points;
    }
  }

  // If no tier matched (value exceeds all maxValues), return last tier's points
  return tiers[tiers.length - 1].points;
}

/**
 * Completion scoring - fixed points with optional bonuses
 */
function calculateCompletionPoints(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): number {
  const config = getScoringConfig(activityType);
  const fixedPoints = toNumber(config["fixedPoints"] ?? config["points"] ?? 0);

  // Optional bonuses are handled separately in the mutation
  // Just return the fixed points here
  return fixedPoints;
}

/**
 * Unit-based scoring with optional cap
 */
function calculateUnitBasedPoints(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): number {
  const config = getScoringConfig(activityType);
  const unit = config["unit"] as string | undefined;
  const pointsPerUnit = toNumber(config["pointsPerUnit"] ?? 1);
  const maxUnits = config["maxUnits"] as number | undefined;
  const basePoints = toNumber(config["basePoints"] ?? 0);

  if (!unit || !context.metrics[unit]) {
    return basePoints;
  }

  let unitValue = toNumber(context.metrics[unit]);

  // Apply cap if maxUnits is defined
  if (maxUnits !== undefined && unitValue > maxUnits) {
    unitValue = maxUnits;
  }

  return basePoints + unitValue * pointsPerUnit;
}

/**
 * Main scoring function - determines scorer type and calculates points
 */
export async function calculateActivityPoints(
  activityType: Doc<"activityTypes">,
  context: ScoringContext
): Promise<number> {
  const config = getScoringConfig(activityType);
  const scoringType = config["type"] as string | undefined;
  const unit = config["unit"];
  const variants = config["variants"];

  // Handle explicit scoring types
  if (scoringType === "tiered") {
    return calculateTieredPoints(activityType, context);
  }

  if (scoringType === "completion") {
    return calculateCompletionPoints(activityType, context);
  }

  if (scoringType === "variable") {
    // Variable scoring is admin-controlled, return 0 for automatic calculation
    return 0;
  }

  // If variants are configured, use variant scorer
  if (variants && typeof variants === "object") {
    return calculateVariantPoints_full(activityType, context);
  }

  // Unit-based with potential cap
  if (scoringType === "unit_based" || unit) {
    // Drink scorer for negative point tracking with daily limits
    if (unit === "drinks") {
      return calculateDrinkPoints(activityType, context);
    }
    return calculateUnitBasedPoints(activityType, context);
  }

  // Default scorer
  return calculateDefaultPoints(activityType, context);
}

interface OptionalBonus {
  name: string;
  bonusPoints: number;
  description: string;
}

/**
 * Calculate optional bonuses for completion-type activities
 * Returns total bonus points and list of triggered bonuses
 */
export function calculateOptionalBonuses(
  activityType: Doc<"activityTypes">,
  selectedBonuses: string[] | undefined
): { totalBonusPoints: number; triggeredBonuses: OptionalBonus[] } {
  const config = getScoringConfig(activityType);
  const optionalBonuses = config["optionalBonuses"] as OptionalBonus[] | undefined;

  if (!optionalBonuses || !selectedBonuses || selectedBonuses.length === 0) {
    return { totalBonusPoints: 0, triggeredBonuses: [] };
  }

  const triggeredBonuses: OptionalBonus[] = [];
  let totalBonusPoints = 0;

  for (const bonus of optionalBonuses) {
    if (selectedBonuses.includes(bonus.name)) {
      triggeredBonuses.push(bonus);
      totalBonusPoints += bonus.bonusPoints;
    }
  }

  return { totalBonusPoints, triggeredBonuses };
}

// Map threshold metric names to activity metric keys
const THRESHOLD_TO_METRIC_KEY: Record<string, string[]> = {
  distance_miles: ["miles", "distance_miles", "distance"],
  distance_km: ["kilometers", "km", "distance_km", "distance"],
  duration_minutes: ["minutes", "duration_minutes", "duration"],
};

/**
 * Calculate threshold bonus points for an activity
 * Returns total bonus points and list of triggered thresholds
 */
export function calculateThresholdBonuses(
  activityType: Doc<"activityTypes">,
  metrics: Record<string, unknown>
): { totalBonusPoints: number; triggeredBonuses: BonusThreshold[] } {
  const thresholds = activityType.bonusThresholds as BonusThreshold[] | undefined;

  if (!thresholds || thresholds.length === 0) {
    return { totalBonusPoints: 0, triggeredBonuses: [] };
  }

  const triggeredBonuses: BonusThreshold[] = [];
  let totalBonusPoints = 0;

  for (const threshold of thresholds) {
    // Try to find the metric value using various possible keys
    const possibleKeys = THRESHOLD_TO_METRIC_KEY[threshold.metric] || [threshold.metric];
    let metricValue = 0;

    for (const key of possibleKeys) {
      const value = toNumber(metrics[key]);
      if (value > 0) {
        metricValue = value;
        break;
      }
    }

    if (metricValue >= threshold.threshold) {
      triggeredBonuses.push(threshold);
      totalBonusPoints += threshold.bonusPoints;
    }
  }

  return { totalBonusPoints, triggeredBonuses };
}
