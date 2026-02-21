import { formatPoints } from "@/lib/points";
import { cn } from "@/lib/utils";

interface PointsDisplayProps {
  points: number;
  isNegative?: boolean;
  decimals?: 0 | 1 | 2;
  size?: "sm" | "base" | "lg" | "xl";
  showSign?: boolean;
  showLabel?: boolean;
  hasBonuses?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
} as const;

export function PointsDisplay({
  points,
  isNegative,
  decimals = 0,
  size = "base",
  showSign = true,
  showLabel = true,
  hasBonuses = false,
  className,
}: PointsDisplayProps) {
  const negative = isNegative ?? points < 0;
  const sign = showSign ? (negative && points >= 0 ? "-" : points > 0 ? "+" : "") : "";
  const formatted = formatPoints(points, decimals);

  return (
    <span
      className={cn(
        "font-semibold",
        sizeClasses[size],
        negative
          ? "text-red-500"
          : hasBonuses
            ? "text-amber-500"
            : "text-primary",
        className,
      )}
    >
      {sign}
      {formatted}
      {showLabel && " pts"}
    </span>
  );
}
