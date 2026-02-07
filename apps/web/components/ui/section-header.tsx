import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * A consistent section header for admin and dashboard pages.
 * Uses uppercase tracking with muted text color.
 */
export function SectionHeader({
  children,
  className,
  size = "sm",
}: SectionHeaderProps) {
  return (
    <h2
      className={cn(
        "font-medium uppercase tracking-wider",
        size === "sm" && "text-xs text-zinc-500",
        size === "md" && "text-sm text-zinc-400",
        className
      )}
    >
      {children}
    </h2>
  );
}
