import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  /** Add a header section with title */
  header?: React.ReactNode;
  /** Padding size - default is "md", use "none" for no padding */
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
};

/**
 * A consistent card component for admin pages.
 * Uses the dark theme with zinc-900 background and zinc-800 border.
 */
export function AdminCard({
  children,
  className,
  header,
  padding = "md",
}: AdminCardProps) {
  return (
    <div
      className={cn(
        "rounded border border-zinc-800 bg-zinc-900",
        !header && paddingClasses[padding],
        className
      )}
    >
      {header && (
        <div className="border-b border-zinc-800 px-3 py-2">{header}</div>
      )}
      {header ? (
        <div className={paddingClasses[padding]}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
