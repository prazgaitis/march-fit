import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatCardColor =
  | "emerald"
  | "blue"
  | "amber"
  | "purple"
  | "cyan"
  | "zinc"
  | "red"
  | "orange";

interface StatCardProps {
  /** Label displayed above the value */
  label: string;
  /** The main value to display */
  value: string | number;
  /** Optional Lucide icon */
  icon?: LucideIcon;
  /** Color theme for the card */
  color?: StatCardColor;
  /** Optional className for customization */
  className?: string;
  /** Optional subtext below the value */
  subtext?: string;
}

const colorClasses: Record<StatCardColor, { text: string; bg: string }> = {
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400/10" },
  blue: { text: "text-blue-400", bg: "bg-blue-400/10" },
  amber: { text: "text-amber-400", bg: "bg-amber-400/10" },
  purple: { text: "text-purple-400", bg: "bg-purple-400/10" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-400/10" },
  zinc: { text: "text-zinc-400", bg: "bg-zinc-400/10" },
  red: { text: "text-red-400", bg: "bg-red-400/10" },
  orange: { text: "text-orange-400", bg: "bg-orange-400/10" },
};

/**
 * A stat card component for displaying metrics.
 * Bloomberg terminal-inspired design with icon and color accent.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  color = "zinc",
  className,
  subtext,
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={cn(
        "rounded border border-zinc-800 bg-zinc-900 p-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {Icon && (
          <div className={cn("rounded p-1", colors.text, colors.bg)}>
            <Icon className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className={cn("mt-1 font-mono text-xl font-semibold", colors.text)}>
        {value}
      </div>
      {subtext && (
        <div className="mt-0.5 text-[10px] text-zinc-500">{subtext}</div>
      )}
    </div>
  );
}
