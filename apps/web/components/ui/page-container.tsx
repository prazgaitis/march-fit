import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Max width preset */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-full",
};

const paddingClasses = {
  none: "",
  sm: "px-2 py-3",
  md: "px-4 py-6",
  lg: "px-6 py-8",
};

/**
 * A consistent page container for centering content with max width.
 * Used primarily in dashboard pages.
 */
export function PageContainer({
  children,
  className,
  maxWidth = "2xl",
  padding = "md",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto",
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
